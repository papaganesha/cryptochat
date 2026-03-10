import { io } from "./server.js";
import { redisClient } from "./redis.js";

export async function sendMessageToInbox(inbox_token, message) {
  console.log("Message:", message);
  await redisClient.rPush(`msg:${inbox_token}`, JSON.stringify(message));

  if (!message.ephemeral) {
    //TTL EM SEGUNDOS PARA MENSAGENS NORMAIS(DIAS)
    const ttlSeconds = message.time * 24 * 60;
    await redisClient.expire(`msg:${inboxToken}`, ttlSeconds);
  }

  const socketId = await redisClient.get(`socket:${inbox_token}`);
  if (socketId) {
    //io.to(socketId).emit("newMessage", message);
    io.to(socketId).emit('message', message);
  }
}

export async function markMessageOpened(inbox_token, message) {
  const messages = await redisClient.lRange(`msg:${inbox_token}`, 0, -1);
  for (let i = 0; i < messages.length; i++) {
    const m = JSON.parse(messages[i]);
    if (m.cyphertext === message.cyphertext) {
      m.opened = true;
      if (m.ephemeral) {
        await redisClient.lRem(`msg:${inbox_token}`, 1, messages[i]);
      } else {
        await redisClient.lSet(`msg:${inbox_tokeninbox_token}`, i, JSON.stringify(m));
      }
      break;
    }
  }
}

export async function sendPendingMessages(inbox_token, socketId) {
  // Pegamos as mensagens do Redis
  const messages = await redisClient.lRange(`msg:${inbox_token}`, -50, -1);
  
  if (!messages || messages.length === 0) return;

  // O erro estava aqui: certifique-se que o nome da variável no argumento 
  // do forEach é EXATAMENTE o mesmo que você usa no JSON.parse
  messages.forEach((msgStr) => { 
    try {
      const msg = JSON.parse(msgStr); // msgStr deve estar definido aqui
      io.to(socketId).emit("newMessage", msg);
    } catch (e) {
      console.error("Erro ao processar mensagem individual:", e);
    }
  });
}