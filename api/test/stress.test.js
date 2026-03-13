import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { io as ioc } from 'socket.io-client';
import { app, io } from '../server.js'; 
import { sequelize } from '../config/db_connect.js';
import { redisClient } from '../config/redis.js';
import { AuthService } from '../services/auth.service.js';
import { User } from '../models/models.js';
import { log } from '../utils/logger.js';

describe('🤯 Teste de Caos: Fluxo Real Concorrente e Stress', () => {
  const PORT = 3011;
  let server;
  const NUM_USERS = 20; // Vamos usar 6 usuários para criar um tráfego cruzado denso
  let users = [];

  beforeAll(async () => {
    server = app.listen(PORT);
    io.attach(server);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Limpeza profunda do banco e cache
    await User.destroy({ where: {}, truncate: { cascade: true } });
    await redisClient.flushAll();

    log.info("Stress", `Criando ${NUM_USERS} usuários para o teste...`);
    
    for (let i = 0; i < NUM_USERS; i++) {
      const name = `user_chaos_${i}`;
      const reg = await AuthService.registerUser(name, 'Senha@123');
      const auth = await AuthService.authenticate(name, 'Senha@123');
      users.push({
        ...auth.user.dataValues,
        token: auth.token,
        socket: null,
        received: []
      });
    }
  });

  afterAll(async () => {
    users.forEach(u => u.socket?.disconnect());
    if (server) server.close();
    await sequelize.close();
    if (redisClient.isOpen) await redisClient.quit();
  });

  it('Deve garantir a entrega e ciclo de vida das mensagens em cenário de alta concorrência', async () => {
    
    // --- FASE 1: METADE ONLINE, METADE OFFLINE ---
    log.info("Phase 1", "Metade dos usuários conectam Socket, a outra metade fica offline...");
    for (let i = 0; i < NUM_USERS / 2; i++) {
      const u = users[i];
      u.socket = ioc(`http://localhost:${PORT}`, { auth: { token: u.token }, transports: ['websocket'] });
      u.socket.on('newMessage', (msg) => u.received.push(msg));
      u.socket.on('offlineMessage', (msg) => u.received.push(msg));
      u.socket.emit('registerInbox', { inboxToken: u.inbox_token });
    }

    // --- FASE 2: BOMBARDEIO DE MENSAGENS CRUZADAS ---
    log.info("Phase 2", "Iniciando envio massivo (Online -> Todos, Offline -> Todos)...");
    const sendRequests = [];

    users.forEach(sender => {
      users.forEach(target => {
        if (sender.id !== target.id) {
          const isEphemeral = Math.random() > 0.5;
          sendRequests.push(
            request(app)
              .post('/messages/send')
              .set('x-authorization', sender.token)
              .send({ 
                toUsername: target.username, 
                cypherText: `De:${sender.username} Para:${target.username} ID:${Math.random()}`, 
                ephemeral: isEphemeral,
                time: 1 // 1 dia de TTL
              })
          );
        }
      });
    });

    await Promise.all(sendRequests);
    log.success("Phase 2", "Todas as mensagens enviadas via HTTP.");

    // --- FASE 3: RECONEXÃO DOS OFFLINE ---
    log.info("Phase 3", "Conectando usuários offline e verificando recebimento retroativo...");
    for (let i = NUM_USERS / 2; i < NUM_USERS; i++) {
      const u = users[i];
      u.socket = ioc(`http://localhost:${PORT}`, { auth: { token: u.token }, transports: ['websocket'] });
      u.socket.on('offlineMessage', (msg) => u.received.push(msg));
      u.socket.emit('registerInbox', { inboxToken: u.inbox_token });
    }

    // Aguarda o processamento dos Sockets (3 segundos)
    await new Promise(r => setTimeout(r, 3000));

    // --- FASE 4: VALIDAÇÃO DE CONTAGEM E SEGURANÇA ---
    log.info("Phase 4", "Validando se todos receberam a quantidade correta...");
    for (const u of users) {
      // Cada user deve ter recebido exatas (NUM_USERS - 1) mensagens
      log.info("Audit", `${u.username} recebeu ${u.received.length} mensagens.`);
      expect(u.received.length).toBe(NUM_USERS - 1);

      // --- FASE 5: MARCAR COMO OPEN (STRESS) ---
      // Simula o usuário lendo todas as mensagens dele
      log.info("Phase 5", `Usuário ${u.username} lendo mensagens...`);
      for (const msg of u.received) {
        const res = await request(app)
          .post('/messages/opened')
          .set('x-authorization', u.token)
          .send({ inbox_token: u.inbox_token, message: msg });
        
        expect(res.status).toBe(200);
      }
    }

    // --- FASE 6: VERIFICAÇÃO FINAL NO REDIS (LIMPEZA) ---
    log.info("Phase 6", "Verificando se o Redis limpou as efêmeras e marcou as normais...");
    for (const u of users) {
      const key = `msg:${u.inbox_token}`;
      const rawMessages = await redisClient.lRange(key, 0, -1);
      
      rawMessages.forEach(mStr => {
        const m = JSON.parse(mStr);
        // Se sobrou no Redis, NÃO pode ser efêmera
        expect(m.ephemeral).toBe(false);
        // E deve estar marcada como aberta
        expect(m.opened).toBe(true);
      });

      // Testa o TTL de uma das chaves que sobrou
      if (rawMessages.length > 0) {
        const ttl = await redisClient.ttl(key);
        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(86400); // 1 dia
      }
    }

    log.success("Stress", "O sistema passou no Teste de Caos com 100% de sucesso!");
  }, 40000); // Timeout longo pois o teste é pesado
});