import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { socketHandlers } from "./socket.js";
import { sequelize, waitForDB } from "./db_connect.js";


const app = express();
const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: true, // Isso resolve 99% dos problemas de conexão em dev
    credentials: true,
  }
});



// Middlewares
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Importações de rotas e handlers APÓS a criação do IO
import authRoutes from "./routes/auth.routes.js";
import messageRoutes from "./routes/messages.routes.js";

// Inicializa os eventos de Socket
socketHandlers(io)

// Registra Rotas
app.use("/auth", authRoutes);
app.use("/messages", messageRoutes);

const PORT = 3000;

async function start() {
  try {
    console.log("⏳ Aguardando Banco de Dados...");
    await waitForDB();
    await sequelize.sync();
    console.log("✅ Banco de Dados conectado.");

    // 3. ESSENCIAL: Usar server.listen em vez de app.listen
    // O app.listen cria um novo servidor e ignora o Socket.io!
    server.listen(PORT, () => {
      console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Falha ao iniciar o servidor:", error);
    process.exit(1);
  }
}

start();


