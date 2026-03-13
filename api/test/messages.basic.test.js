import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { io as ioc } from 'socket.io-client';
import { app, io } from '../server.js'; 
import { sequelize } from '../config/db_connect.js';
import { redisClient } from '../config/redis.js';
import { AuthService } from '../services/auth.service.js';
import { User } from '../models/models.js';
import { log } from '../utils/logger.js';

describe('🚀 Suite Final: Fluxo de Mensagens Ponta-a-Ponta', () => {
  let userToken, receptorToken, inboxToken, socket, server;
  const PORT = 3008;

  const userA = { username: 'remetente_final', password: '123' };
  const userB = { username: 'receptor_final', password: '123' };

  beforeAll(async () => {
    server = app.listen(PORT);
    io.attach(server); // Garante que o Socket.io está ligado ao servidor do teste
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    await User.destroy({ where: {}, truncate: { cascade: true } });

    // 1. Criar e Autenticar Receptor
    const receptor = await AuthService.registerUser(userB.username, userB.password);
    inboxToken = receptor.inbox_token;
    const authB = await AuthService.authenticate(userB.username, userB.password);
    receptorToken = authB.token;

    // 2. Criar e Autenticar Remetente
    await AuthService.registerUser(userA.username, userA.password);
    const authA = await AuthService.authenticate(userA.username, userA.password);
    userToken = authA.token;

    log.info("Test", "Usuários e Servidor prontos para fluxo total.");
  });

  afterAll(async () => {
    if (socket) socket.disconnect();
    if (server) server.close();
    await sequelize.close();
    if (redisClient.isOpen) await redisClient.quit();
  });

  beforeEach(async () => {
    await redisClient.flushAll();
    if (socket) socket.disconnect();
  });

  // --- FLUXO 1: TEMPO REAL (SOCKET.IO) ---
  describe('⚡ Fluxo em Tempo Real (Socket.io)', () => {
    it('Deve receber mensagem via Socket quando o receptor estiver online', async () => {
      // Conecta o socket do receptor
      socket = ioc(`http://localhost:${PORT}`, { 
        auth: { token: receptorToken }, 
        transports: ['websocket'] 
      });

      return new Promise((resolve, reject) => {
        // O handler do socket no seu servidor deve emitir 'registerInbox' ou similar
        socket.emit('registerInbox', { inboxToken });

        socket.on('newMessage', (msg) => {
          expect(msg.cyphertext).toBe('CONTEUDO_SOCKET');
          resolve();
        });

        // Simula envio via HTTP enquanto o socket está ouvindo
        request(app)
          .post('/messages/send')
          .set('x-authorization', userToken)
          .send({ toUsername: userB.username, cypherText: 'CONTEUDO_SOCKET', ephemeral: true })
          .end((err) => { if (err) reject(err); });
      });
    });
  });

  // --- FLUXO 2: MENSAGENS PENDENTES (OFFLINE) ---
  describe('📥 Fluxo Offline (Pending Messages)', () => {
    it('Deve recuperar mensagens enviadas enquanto o receptor estava offline', async () => {
      // 1. Remetente envia mensagem (Receptor está offline/sem socket)
      await request(app)
        .post('/messages/send')
        .set('x-authorization', userToken)
        .send({ toUsername: userB.username, cypherText: 'MENSAGEM_OFFLINE', ephemeral: false });

      // 2. Receptor conecta agora
      socket = ioc(`http://localhost:${PORT}`, { 
        auth: { token: receptorToken }, 
        transports: ['websocket'] 
      });

      return new Promise((resolve) => {
        socket.on('offlineMessage', (msg) => {
          if (msg.cyphertext === 'MENSAGEM_OFFLINE') {
            resolve();
          }
        });
        socket.emit('registerInbox', { inboxToken });
      });
    });
  });

  // --- FLUXO 3: PERSISTÊNCIA E EXPIRAÇÃO (TTL) ---
  describe('⏳ Fluxo de Expiração (TTL)', () => {
    it('Deve configurar TTL no Redis para mensagens não-efêmeras (Time em dias)', async () => {
      const dias = 2;
      await request(app)
        .post('/messages/send')
        .set('x-authorization', userToken)
        .send({ 
          toUsername: userB.username, 
          cypherText: 'MENSAGEM_COM_PRAZO', 
          ephemeral: false,
          time: dias 
        });

      const ttl = await redisClient.ttl(`msg:${inboxToken}`);
      // 2 dias = 172800 segundos. Verificamos se está próximo disso.
      expect(ttl).toBeGreaterThan(172000); 
    });

    it('Deve ter TTL de 24h (86400s) para mensagens efêmeras por padrão', async () => {
      await request(app)
        .post('/messages/send')
        .set('x-authorization', userToken)
        .send({ toUsername: userB.username, cypherText: 'EFEMERA_PADRAO', ephemeral: true });

      const ttl = await redisClient.ttl(`msg:${inboxToken}`);
      expect(ttl).toBeLessThanOrEqual(86400);
      expect(ttl).toBeGreaterThan(86300);
    });
  });

  // --- FLUXO 4: SEGURANÇA DE BORDA ---
  describe('🚫 Casos de Falha e Segurança', () => {
    it('Deve retornar 401 se tentar enviar mensagem com token inválido', async () => {
      const res = await request(app)
        .post('/messages/send')
        .set('x-authorization', 'token-lixo')
        .send({ toUsername: userB.username, cypherText: 'HACK', ephemeral: true });

      expect(res.status).toBe(401);
    });

    it('Deve falhar ao tentar marcar como aberta uma mensagem que não existe', async () => {
      const res = await request(app)
        .post('/messages/opened')
        .set('x-authorization', receptorToken)
        .send({ 
          inbox_token: inboxToken, 
          message: { cyphertext: 'NAO_EXISTO', ephemeral: true } 
        });

      expect(res.status).toBe(403); // Conforme sua lógica no Service/Controller
      expect(res.body.error).toBe("Mensagem não encontrada no Redis");
    });
  });
});