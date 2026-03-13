import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { io as ioc } from 'socket.io-client';
import { app, io } from '../server.js'; 
import { sequelize } from '../config/db_connect.js';
import { redisClient } from '../config/redis.js';
import { AuthService } from '../services/auth.service.js';
import { User } from '../models/models.js';
import { log } from '../utils/logger.js';

describe('🌪️ TESTE ULTIMATE: Caos, Stress e Fluxo Real', () => {
  const PORT = 3012;
  let server;
  let users = [];
  const TOTAL_USERS = 60;

beforeAll(async () => {
    server = app.listen(PORT);
    io.attach(server);
    await new Promise(res => setTimeout(res, 2000));
    
    await User.destroy({ where: {}, truncate: { cascade: true } });
    await redisClient.flushAll();

    log.info("Setup", `Iniciando criação de ${TOTAL_USERS} usuários em lotes...`);

    // Processamos em lotes de 5 para não travar o Event Loop nem o Pool do Postgres
    for (let i = 0; i < TOTAL_USERS; i += 5) {
      const batch = [];
      for (let j = i; j < i + 5 && j < TOTAL_USERS; j++) {
        const name = `bot_${j}`;
        batch.push((async () => {
          const reg = await AuthService.registerUser(name, 'pass123');
          const auth = await AuthService.authenticate(name, 'pass123');
          return {
            ...auth.user.dataValues,
            token: auth.token,
            socket: null,
            inbox: [],
            offlineInbox: []
          };
        })());
      }
      const results = await Promise.all(batch);
      users.push(...results);
      log.info("Setup", `Progresso: ${users.length}/${TOTAL_USERS} usuários criados...`);
    }
  }, 60000); // TIMEOUT DE 60 SEGUNDOS AQUI

  afterAll(async () => {
    users.forEach(u => u.socket?.disconnect());
    server.close();
    await sequelize.close();
    if (redisClient.isOpen) await redisClient.quit();
  });

  it('Deve validar o fluxo de mensagens sob condições de estresse e alternância de estado', async () => {
    
    // 1. METADE CONECTA (ONLINE), METADE ESPERA (OFFLINE)
    log.info("Chaos", "Fase 1: Metade dos usuários entram no Socket...");
    for (let i = 0; i < TOTAL_USERS / 2; i++) {
      const u = users[i];
      u.socket = ioc(`http://localhost:${PORT}`, { auth: { token: u.token } });
      u.socket.emit('registerInbox', { inboxToken: u.inbox_token });
      u.socket.on('newMessage', (m) => u.inbox.push(m));
      u.socket.on('offlineMessage', (m) => u.offlineInbox.push(m));
    }

    // 2. DISPARO CRUZADO (BOMBARDEIO)
    log.info("Chaos", "Fase 2: Todos os usuários enviam mensagens para todos (Total: 56 msgs)");
    const requests = [];
    users.forEach(sender => {
      users.forEach(target => {
        if (sender.id !== target.id) {
          const isEph = Math.random() > 0.5;
          requests.push(
            request(app)
              .post('/messages/send')
              .set('x-authorization', sender.token)
              .send({ 
                toUsername: target.username, 
                cypherText: `De:${sender.username}_Para:${target.username}_Ref:${Math.random()}`, 
                ephemeral: isEph,
                time: 1 
              })
          );
        }
      });
    });
    await Promise.all(requests);

    // 3. RECONEXÃO DOS OFFLINE E ENTREGA RETROATIVA
    log.info("Chaos", "Fase 3: Usuários Offline conectam para resgatar mensagens...");
    for (let i = TOTAL_USERS / 2; i < TOTAL_USERS; i++) {
      const u = users[i];
      u.socket = ioc(`http://localhost:${PORT}`, { auth: { token: u.token } });
      u.socket.on('offlineMessage', (m) => u.offlineInbox.push(m));
      u.socket.emit('registerInbox', { inboxToken: u.inbox_token });
    }

    // Aguarda processamento de filas
    await new Promise(res => setTimeout(res, 4000));

    // 4. AUDITORIA DE RECEBIMENTO
    log.info("Chaos", "Fase 4: Auditando integridade das mensagens...");
    for (const u of users) {
      const totalRecebido = u.inbox.length + u.offlineInbox.length;
      log.info("Audit", `${u.username} -> Online: ${u.inbox.length} | Offline: ${u.offlineInbox.length} | Total: ${totalRecebido}`);
      
      // Cada user deve ter recebido exatamente TOTAL_USERS - 1 mensagens
      expect(totalRecebido).toBe(TOTAL_USERS - 1);
    }

    // 5. TESTE DE CONSUMO (OPENED) E LIMPEZA DE REDIS
    log.info("Chaos", "Fase 5: Simulando leitura de mensagens e limpeza do Redis...");
    for (const u of users) {
      const allMsgs = [...u.inbox, ...u.offlineInbox];
      for (const msg of allMsgs) {
        const res = await request(app)
          .post('/messages/opened')
          .set('x-authorization', u.token)
          .send({ inbox_token: u.inbox_token, message: msg });
        
        expect(res.status).toBe(200);
      }

      // Verificação pós-leitura no Redis
      const key = `msg:${u.inbox_token}`;
      const remainingRaw = await redisClient.lRange(key, 0, -1);
      
      remainingRaw.forEach(mStr => {
        const m = JSON.parse(mStr);
        expect(m.ephemeral).toBe(false); // Efêmeras devem ter sido deletadas (LREM)
        expect(m.opened).toBe(true);      // Persistentes devem estar marcadas (LSET)
      });

      // Valida TTL
      if (remainingRaw.length > 0) {
        const ttl = await redisClient.ttl(key);
        expect(ttl).toBeGreaterThan(0);
      }
    }

    log.success("Stress", "O sistema suportou o caos sem falhas de integridade!");
  }, 100000);
}, );