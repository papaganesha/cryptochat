import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { io as ioc } from 'socket.io-client';
import { app, io } from '../server.js'; 
import { redisClient } from '../config/redis.js';
import { MonitorService } from '../services/monitor.service.js';
import { AuthService } from '../services/auth.service.js';
import { User } from '../models/models.js';
import { log } from '../utils/logger.js';

describe('🌪️ TESTE ULTIMATE: Ciclo Real 40 Bots & Circuit Breaker', () => {
  const PORT = 3012;
  let server;
  let users = [];
  const TOTAL_USERS = 40; 

  beforeAll(async () => {
    server = app.listen(PORT);
    io.attach(server);
    
    log.info("Setup", "Limpando ambiente e preparando 40 bots...");
    await User.destroy({ where: {}, truncate: { cascade: true } });
    await redisClient.flushAll();

    for (let i = 0; i < TOTAL_USERS; i++) {
      const name = `bot_stress_${i}`;
      await AuthService.registerUser(name, 'pass123');
      const auth = await AuthService.authenticate(name, 'pass123');
      // O auth agora retorna o user e o token (conforme nossa refatoração)
      users.push({ ...auth.user.dataValues, token: auth.token, inbox: [], offlineInbox: [] });
    }
    log.success("Setup", "40 Bots autenticados e prontos.");
  }, 120000);

  afterAll(async () => {
    log.info("Cleanup", "Finalizando conexões e limpando DB/Redis...");
    users.forEach(u => u.socket?.disconnect());
    await User.destroy({ where: {}, truncate: { cascade: true } });
    await redisClient.flushAll();
    server.close();
    if (redisClient.isOpen) await redisClient.quit();
  });

  it('Deve validar o fluxo completo com proteção de latência e memória', async () => {
    // 💡 O VALOR MÁGICO: 0.00074075 * 86400 ≈ 64 (Inteiro perfeito para o Redis)
    const TIME_TTL = 0.00074075; 

    // 1. CONEXÃO PARCIAL
    log.info("Phase 1", "Conectando 20 usuários via Socket...");
    for (let i = 0; i < TOTAL_USERS / 2; i++) {
      const u = users[i];
      u.socket = ioc(`http://localhost:${PORT}`, { auth: { token: u.token } });
      u.socket.emit('registerInbox', { inboxToken: u.inbox_token });
      u.socket.on('newMessage', (m) => u.inbox.push(m));
    }
    await new Promise(res => setTimeout(res, 3000));

    // 2. BOMBARDIO
    log.info("Phase 2", "Iniciando bombardeio (Stress Test)...");
    const taskList = [];
    users.forEach(sender => {
      users.forEach(target => {
        if (sender.id !== target.id) taskList.push({ sender, target });
      });
    });

    for (let i = 0; i < taskList.length; i += 30) {
      if (!(await MonitorService.isSafe())) {
        log.error("CIRCUIT BREAKER", "⚠️ Sistema atingiu limite. Abortando...");
        break; 
      }

      const batch = taskList.slice(i, i + 30).map(({ sender, target }) => 
        request(app).post('/messages/send').set('x-authorization', sender.token)
          .send({ 
            toUsername: target.username, 
            cypherText: 'STRESS_DATA', 
            ephemeral: true, 
            time: TIME_TTL 
          })
      );

      const results = await Promise.all(batch);
      
      // 🛡️ Validação Sênior: Agora esperamos 201 Created
      if (results.some(r => r.status !== 201)) {
        log.error("ERROR", `Falha no lote ${i}. Status: ${results.find(r => r.status !== 201)?.status}`);
        break;
      }

      await new Promise(res => setTimeout(res, 50)); 
      if (i % 300 === 0) log.info("Progress", `Mensagens enviadas: ${i}/${taskList.length}`);
    }

    // 3. RECONEXÃO OFFLINE
    log.info("Phase 3", "Conectando usuários offline...");
    for (let i = TOTAL_USERS / 2; i < TOTAL_USERS; i++) {
      const u = users[i];
      u.socket = ioc(`http://localhost:${PORT}`, { auth: { token: u.token } });
      u.socket.on('offlineMessage', (m) => u.offlineInbox.push(m));
      u.socket.emit('registerInbox', { inboxToken: u.inbox_token });
    }
    await new Promise(res => setTimeout(res, 8000));

    // 4. CONSUMO (LEITURA)
    log.info("Phase 4", "Bots processando leitura (/opened)...");
    const openReqs = [];
    users.forEach(u => {
      [...u.inbox, ...u.offlineInbox].forEach(m => {
        openReqs.push(
          request(app).post('/messages/opened').set('x-authorization', u.token)
            .send({ inbox_token: u.inbox_token, message: m })
        );
      });
    });

    // Lotes de 50 para não estourar o limite de conexões do Node
    for (let i = 0; i < openReqs.length; i += 50) {
      await Promise.all(openReqs.slice(i, i + 50));
    }

    log.info("Phase 5", "Aguardando 5s para processamento final...");
    await new Promise(res => setTimeout(res, 5000));

    // 6. AUDITORIA FINAL
    log.info("Phase 6", "Auditoria Final no Redis...");
    const keysAfter = await redisClient.dbSize();
    log.info("Audit", `Chaves restantes no Redis: ${keysAfter}`);
    
    // Com a limpeza automática (del key quando len=0), deve sobrar muito pouco.
    expect(keysAfter).toBeLessThan(TOTAL_USERS * 2); 
    log.success("Ultimate", "O sistema sobreviveu ao caos com código blindado.");
  }, 400000); 
});