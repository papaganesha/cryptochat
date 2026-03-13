import { redisClient } from "./redis.js";
import { MessageService } from "../services/messages.service.js";

export function socketHandlers(io) {
  const { sendPendingMessages } = MessageService;
  io.on("connection", (socket) => {
    console.log("🔌 Novo cliente conectado:", socket.id);

    socket.on("registerInbox", async ({ inboxToken }) => {
      // 1. Vincula o token à instância do socket para uso posterior
      socket.inboxToken = inboxToken;
      
      // 2. O socket entra na sala (room) do token
      socket.join(inboxToken); 
      console.log(`📥 Socket ${socket.id} registrado para inbox ${inboxToken}`);

      // 3. Salva o ID no Redis para entregas em tempo real
      await redisClient.set(`socket:${inboxToken}`, socket.id);

      // 4. Dispara o envio das mensagens que chegaram enquanto ele estava offline
      // Note que o frontend deve ouvir o evento 'offlineMessage' para estas
      await sendPendingMessages(inboxToken, socket.id);
    });

    socket.on("disconnect", async () => {
      console.log("❌ Cliente desconectado:", socket.id);
      
      // 5. LIMPEZA: Se o socket tinha um token, removemos o ID do Redis
      // Isso evita que o sendMessageToInbox tente usar um socket morto
      if (socket.inboxToken) {
        await redisClient.del(`socket:${socket.inboxToken}`);
        console.log(`🧹 Registro do socket removido para o token: ${socket.inboxToken}`);
      }
    });
  });
}