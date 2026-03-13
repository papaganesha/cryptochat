import { createClient } from "redis";

// Configura o cliente Redis
export const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379"
});

// Listener de erro para não derrubar a aplicação caso o Redis caia depois de subir
redisClient.on("error", (err) => console.log("❌ Redis Error:", err));

/**
 * Função que aguarda o Redis estar pronto para batalha.
 * Tenta pingar o servidor até receber um "PONG".
 */
export async function waitForRedis() {
  let connected = false;

  while (!connected) {
    try {
      // 1. Tenta conectar se ainda não estiver conectado
      if (!redisClient.isOpen) {
        await redisClient.connect();
      }
      
      // 2. Envia um PING (o Redis deve responder PONG)
      await redisClient.ping();
      
      connected = true;
      console.log("✅ Redis: Respondendo corretamente (PONG).");
    } catch (error) {
      console.log("⏳ Redis: Servidor não respondeu. Tentando novamente em 2s...");
      // Espera 2 segundos antes da próxima tentativa
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}