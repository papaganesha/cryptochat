import { redisClient } from "./redis.js";

import { sendPendingMessages } from "./messages.js";

export function socketHandlers(io) {
  io.on("connection", (socket) => {
    console.log("Client connected: ", socket.id)
    socket.on("registerInbox", async ({ inboxToken }) => {
      // 1. O socket entra na sala do token (essencial para multi-dispositivo)
      socket.join(inboxToken); 
      
      // 2. Salva o ID no Redis (como você já fazia)
      await redisClient.set(`socket:${inboxToken}`, socket.id);
      
      // 3. Envia as pendentes (agora passando apenas o token)
      await sendPendingMessages(inboxToken, socket.id);
    });


    socket.on("disconnect", () => {
      console.log("Client disconnected: ", socket.id);
      // Opcional: remover do Redis aqui para não tentar enviar para socket morto
    });
  });
}
