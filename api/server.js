import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { socketHandlers } from "./config/socket.js";
import cors from "cors";

// Importações das verificações de saúde
import { waitForDB } from "./config/db_connect.js";
import { waitForRedis } from "./config/redis.js"; // Nova função aqui!
import { MonitorService } from "./services/monitor.service.js"; // Importa o serviço de monitoramento

import authRoutes from "./routes/auth.routes.js";
import messageRoutes from "./routes/messages.routes.js";

const app = express();
const httpServer = createServer(app);

app.use(cors());
app.use(express.json());

// Rotas
app.use("/auth", authRoutes);
app.use("/messages", messageRoutes);

// Exportamos o IO para ser usado nos Services
const io = new Server(httpServer, { cors: { origin: "*" } });
socketHandlers(io); // Configura os handlers de socket
/**
 * Função de inicialização orquestrada
 */

export { app, io } // <--- ISSO TEM QUE ESTAR AQUI

const startServer = async () => {
  console.log("🛠️ Iniciando verificações de sistema...");

  try {
    // 1. Aguarda o Banco de Dados Relacional (Postgres)
    await waitForDB();

    // 2. Aguarda o Banco de Dados em Memória (Redis)
    await waitForRedis();

    // 3. Define a porta e sobe o servidor
   if(process.env.NODE_ENV !== "test") {
    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, () => {
      console.log(`🚀 SERVIDOR ONLINE: http://localhost:${PORT}`);
      // Inicia o monitoramento do Redis (2GB limit) a cada 30 segundos
  MonitorService.start(30);
    })
  }else{
    console.log("⚠️ Modo de Teste: Servidor não iniciado, mas dependências estão OK.");
  }
    
  } catch (criticalError) {
    // Se algo der muito errado no boot, o servidor avisa e não sobe
    console.error("🚨 FALHA CRÍTICA NO BOOT:", criticalError);
    process.exit(1); // Encerra o processo com erro
  }
};

startServer();