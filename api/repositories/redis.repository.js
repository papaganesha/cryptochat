import { RedisRepository } from "../repositories/redis.repository.js";
import { log } from "../utils/logger.js";
import { io } from "../server.js";

export const MessageService = {
  async send(receiver, messageData) {
    const { inbox_token } = receiver;
    
    // Salva no Redis
    await RedisRepository.addMessage(inbox_token, messageData);
    
    // Define TTL (Se efêmera 24h de segurança, se comum o tempo escolhido)
    const ttl = messageData.ephemeral ? 86400 : (messageData.time * 86400);
    await RedisRepository.setExpiration(inbox_token, ttl);

    log.success("MessageService", `Mensagem guardada na inbox ${inbox_token}`);

    // Tenta entregar via Socket se online
    const socketId = await redisClient.get(`socket:${inbox_token}`);
    if (socketId) {
      io.to(socketId).emit("newMessage", messageData);
    }
  },

  async open(inboxToken, messageToOpen) {
    const rawMessages = await RedisRepository.getAllMessages(inboxToken);
    
    for (let i = 0; i < rawMessages.length; i++) {
      const m = JSON.parse(rawMessages[i]);
      
      if (m.cyphertext === messageToOpen.cyphertext) {
        if (m.ephemeral === true || m.ephemeral === "true") {
          // GATILHO DE DESTRUIÇÃO (O que você pediu!)
          await RedisRepository.removeMessage(inboxToken, rawMessages[i]);
          log.redis(`Mensagem efêmera DELETADA do Redis.`);
        } else {
          // APENAS MARCA COMO LIDA
          m.opened = true;
          await RedisRepository.updateMessage(inboxToken, i, m);
          log.info("MessageService", "Mensagem comum marcada como aberta.");
        }
        return true;
      }
    }
    return false;
  }
};