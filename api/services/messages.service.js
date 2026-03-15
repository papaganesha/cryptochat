import { io } from "../server.js";
import { redisClient } from "../config/redis.js";
import { log } from "../utils/logger.js";

export const MessageService = {

  // 1. Enviar mensagem (Com o FIX do TTL Inteiro)
  async send(receiver, message) {
    const inbox_token = receiver.inbox_token;
    const key = `msg:${inbox_token}`;
    
    await redisClient.rPush(key, JSON.stringify(message));

    // Fix de decimal: 0.0007 dias vira um inteiro redondo em segundos
    const days = parseFloat(message.time) || 0.0007;
    const ttlSeconds = Math.max(1, Math.round(days * 86400));

    // Se for efêmera, usa o tempo curto; se não, 7 dias padrão
    await redisClient.expire(key, message.ephemeral ? ttlSeconds : 604800);

    const socketId = await redisClient.get(`socket:${inbox_token}`);
    if (socketId) {
      io.to(socketId).emit('newMessage', message);
    }
  },

  // 2. Abrir mensagem (Limpeza do Redis)
  async open(inbox_token, message) {
    const key = `msg:${inbox_token}`;
    const messages = await redisClient.lRange(key, 0, -1);
    
    for (let i = 0; i < messages.length; i++) {
      try {
        const m = JSON.parse(messages[i]);
        if (m.cyphertext === message.cyphertext) {
          if (m.ephemeral) {
            await redisClient.lRem(key, 1, messages[i]);
            if (await redisClient.lLen(key) === 0) await redisClient.del(key);
          } else {
            m.opened = true;
            await redisClient.lSet(key, i, JSON.stringify(m));
          }
          return true; 
        }
      } catch (e) {
        continue;
      }
    }
    return false;
  },

  // 3. Mensagens pendentes (Recuperada e Otimizada)
  async sendPendingMessages(inbox_token, socketId) {
    const key = `msg:${inbox_token}`;
    // Pegamos as últimas 50 mensagens para não sobrecarregar o socket de uma vez
    const messages = await redisClient.lRange(key, -50, -1);
    
    if (!messages || messages.length === 0) return;

    messages.forEach((msgStr) => { 
      try {
        const msg = JSON.parse(msgStr);
        // Enviamos para o socket específico que acabou de registrar a inbox
        io.to(socketId).emit("offlineMessage", msg);
      } catch (e) {
        log.error("Redis", "Erro ao processar mensagem pendente no JSON.parse");
      }
    });
  }
};