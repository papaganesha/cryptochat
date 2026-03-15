import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../server.js';
import { User } from '../models/models.js';
import { redisClient } from '../config/redis.js';
import { MonitorService } from '../services/monitor.service.js';
import { log } from '../utils/logger.js';

describe('🔐 AUTH ULTIMATE: Ciclo de Vida Completo (Criação ao Purge)', () => {
  const PORT = 3090;
  let server;
  const STRESS_COUNT = 15; // Quantidade de usuários para o teste de carga

  beforeAll(async () => {
    server = app.listen(PORT);
    // Limpeza preventiva antes de começar
    await User.destroy({ where: {}, truncate: { cascade: true } });
    if (redisClient.isOpen) await redisClient.flushAll();
  });

  afterAll(async () => {
    log.info("CLEANUP", "Iniciando limpeza total de usuários e cache...");
    
    // 1. Exclui todos os usuários do Banco de Dados
    const deletedCount = await User.destroy({ where: {}, truncate: { cascade: true } });
    
    // 2. Limpa o Redis (Tokens e monitoramento)
    if (redisClient.isOpen) await redisClient.flushAll();
    
    // 3. Fecha conexões
    server.close();
    if (redisClient.isOpen) await redisClient.quit();

    log.success("CLEANUP", `Sucesso: ${deletedCount} usuários removidos e Redis zerado.`);
  });

  it('Deve validar o fluxo completo: Registro -> Login -> Saúde -> Exclusão', async () => {
    // --- PASSO 1: REGISTRO EM MASSA (Criação) ---
    log.info("TEST", `Registrando ${STRESS_COUNT} usuários dinâmicos...`);
    const registerPromises = Array.from({ length: STRESS_COUNT }).map((_, i) => 
      request(app).post('/auth/register').send({ 
        username: `flow_user_${i}`, 
        password: `pass_${i}` 
      })
    );
    const regResults = await Promise.all(registerPromises);
    
    regResults.forEach(res => expect(res.status).toBe(201));

    // --- PASSO 2: LOGIN E VALIDAÇÃO DE JWT (Uso) ---
    log.info("TEST", "Executando logins simultâneos e validando tokens...");
    const loginPromises = Array.from({ length: STRESS_COUNT }).map((_, i) => 
      request(app).post('/auth/login').send({ 
        username: `flow_user_${i}`, 
        password: `pass_${i}` 
      })
    );
    const loginResults = await Promise.all(loginPromises);

    loginResults.forEach((res, i) => {
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.inbox_token).toBeDefined(); // Valida sua nova estrutura
    });

    // --- PASSO 3: MONITORAMENTO (Saúde do Sistema) ---
    const health = await MonitorService.checkRedisHealth();
    log.info("MONITOR", `Latência pós-estresse: ${health.latency}ms`);
    
    // Se o sistema estiver instável, o teste falha aqui
    expect(await MonitorService.isSafe()).toBe(true);

    // --- PASSO 4: INTEGRIDADE DO BANCO ---
    const count = await User.count();
    expect(count).toBe(STRESS_COUNT);
    
    log.success("AUTH", "Fluxo de autenticação e carga validado com sucesso.");
  });
});