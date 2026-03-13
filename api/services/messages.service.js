import { io } from "../server.js";
import { redisClient } from "../config/redis.js";

// Envelopamos tudo no objeto que o Controller está procurando
export const MessageService = {

  // Enviar mensagem (Antiga sendMessageToInbox)
  async send(receiver, message) {
    const inbox_token = receiver.inbox_token; // Extrai o token do objeto
    // 1. Salva no Redis (Persistência Offline)
    await redisClient.rPush(`msg:${inbox_token}`, JSON.stringify(message));

    // Define o TTL (Tempo de vida)
    if (!message.ephemeral) {
      const ttlSeconds = message.time * 24 * 60 * 60;
      await redisClient.expire(`msg:${inbox_token}`, ttlSeconds);
    } else {
      await redisClient.expire(`msg:${inbox_token}`, 86400); // 24h para efêmeras
    }

    // 2. Entrega em tempo real
    const socketId = await redisClient.get(`socket:${inbox_token}`);
    if (socketId) {
      io.to(socketId).emit('newMessage', message);
    }
  },

  // Abrir mensagem (Antiga markMessageOpened)
async open(inbox_token, message) {
    const key = `msg:${inbox_token}`;
    const messages = await redisClient.lRange(key, 0, -1);
    
    for (let i = 0; i < messages.length; i++) {
      const m = JSON.parse(messages[i]);
      
      if (m.cyphertext === message.cyphertext) {
        if (m.ephemeral) {
          await redisClient.lRem(key, 1, messages[i]);
          
          // CRUCIAL para o teste "Limpar a lista":
          const remaining = await redisClient.lLen(key);
          if (remaining === 0) await redisClient.del(key);
        } else {
          m.opened = true;
          await redisClient.lSet(key, i, JSON.stringify(m));
        }
        return true; 
      }
    }
    return false;
  },

  // Mensagens pendentes (Antiga sendPendingMessages)
  async sendPendingMessages(inbox_token, socketId) {
    const messages = await redisClient.lRange(`msg:${inbox_token}`, -50, -1);
    if (!messages || messages.length === 0) return;

    messages.forEach((msgStr) => { 
      try {
        const msg = JSON.parse(msgStr);
        io.to(socketId).emit("offlineMessage", msg);
      } catch (e) {
        log.error("❌ Erro no processamento:", e);
      }
    });
  }
};