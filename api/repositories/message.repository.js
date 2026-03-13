import { redisClient } from "../config/redis.js";

export const MessageRepository = {
  // Salva no final da lista (Fila de inbox)
  async pushToInbox(inboxToken, messageObj) {
    const key = `msg:${inboxToken}`;
    return await redisClient.rPush(key, JSON.stringify(messageObj));
  },

  // Busca todas as mensagens de uma inbox específica
  async fetchAll(inboxToken) {
    return await redisClient.lRange(`msg:${inboxToken}`, 0, -1);
  },

  // Remove UMA ocorrência específica de uma mensagem (Usado para Efêmeras)
  async deleteOne(inboxToken, rawString) {
    return await redisClient.lRem(`msg:${inboxToken}`, 1, rawString);
  },

  // Atualiza uma mensagem em uma posição específica (Usado para Comuns)
  async updateAtIndex(inboxToken, index, messageObj) {
    return await redisClient.lSet(`msg:${inboxToken}`, index, JSON.stringify(messageObj));
  },

  // Define quanto tempo a lista inteira de mensagens dura no banco
  async setTTL(inboxToken, seconds) {
    return await redisClient.expire(`msg:${inboxToken}`, seconds);
  }
};