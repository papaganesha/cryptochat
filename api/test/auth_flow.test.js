import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AuthService } from '../services/auth.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { sequelize } from '../config/db_connect.js';
import { redisClient } from '../config/redis.js';
import { log } from '../utils/logger.js';
import { User } from '../models/models.js';

// Importa o server para garantir o startServer()
import '../server.js'; 

describe('🔐 Suite de Testes: Autenticação Completa', () => {
  
  const usuarioFixo = {
    username: 'usuario_estavel',
    password: 'SenhaForte@123'
  };

  beforeAll(async () => {
    log.info("Test", "Preparando ambiente de autenticação...");
    // Aguarda o boot do server.js
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // LIMPEZA: Remove o usuário de teste se ele já existir para começar do zero
    await User.destroy({ where: { username: usuarioFixo.username } });
  });

  afterAll(async () => {
    await sequelize.close();
    await redisClient.quit();
    log.success("Test", "Conexões encerradas.");
  });

  describe('📝 Registro de Usuário', () => {
    it('Deve registrar um novo usuário com sucesso', async () => {
      const user = await AuthService.registerUser(usuarioFixo.username, usuarioFixo.password);
      
      expect(user).toBeDefined();
      expect(user.username).toBe(usuarioFixo.username);
      // Checa se o inbox_token foi gerado automaticamente (default no model ou service)
      expect(user.inbox_token).toBeDefined(); 
      log.success("Test", "Registro inicial OK.");
    });

    it('Deve impedir o registro de um username já existente', async () => {
      // Tentamos registrar o mesmo usuarioFixo novamente
      await expect(
        AuthService.registerUser(usuarioFixo.username, 'outra_senha')
      ).rejects.toThrow(); 
      // Se o seu service lança um erro específico de banco, 
      // o Vitest vai capturar aqui.
      log.success("Test", "Bloqueio de usuário duplicado OK.");
    });

    it('Deve garantir que o password no banco é um hash Bcrypt', async () => {
      const userNoBanco = await UserRepository.findByUsername(usuarioFixo.username);
      
      // A senha não pode ser texto puro
      expect(userNoBanco.password).not.toBe(usuarioFixo.password);
      // Padrão de hash Bcrypt
      expect(userNoBanco.password).toMatch(/^\$2[ayb]\$.+/);
    });
  });

  describe('🔑 Processo de Login', () => {
    it('Deve realizar login com credenciais corretas e retornar JWT', async () => {
      const data = await AuthService.authenticate(usuarioFixo.username, usuarioFixo.password);
      
      expect(data).toHaveProperty('token');
      expect(data).toHaveProperty('user');
      expect(data.user.username).toBe(usuarioFixo.username);
      log.success("Test", "Login com sucesso retornou Token.");
    });

    it('Deve falhar o login com senha incorreta', async () => {
      await expect(
        AuthService.authenticate(usuarioFixo.username, 'senha_errada')
      ).rejects.toThrow("Invalid credentials."); 
      log.success("Test", "Erro de credenciais inválidas OK.");
    });

    it('Deve falhar o login de um usuário que não existe', async () => {
      await expect(
        AuthService.authenticate('fantasma_99', '123456')
      ).rejects.toThrow("Credentials not found."); 
      log.success("Test", "Erro de usuário inexistente OK.");
    });
  });

  describe('🛡️ Integridade do Token e Repositório', () => {
    it('Deve conseguir recuperar os dados do usuário pelo ID após login', async () => {
      // 1. Loga para pegar o ID
      const { user } = await AuthService.authenticate(usuarioFixo.username, usuarioFixo.password);
      
      // 2. Busca no repositório pelo ID (Simulando o que o middleware JWT faz)
      const userById = await UserRepository.findById(user.id);
      
      expect(userById.username).toBe(usuarioFixo.username);
      expect(userById).toHaveProperty('inbox_token');
      expect(userById.password).toBeUndefined(); // Garante que o ID find não vaza a senha se configurado no repository
      log.success("Test", "Recuperação por ID (Middleware Simulation) OK.");
    });
  });
});