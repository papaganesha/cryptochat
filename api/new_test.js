import { io as ioc } from "socket.io-client";
import { User } from "./models/models.js"; 
import { redisClient } from "./redis.js";

const SLEEP = (ms) => new Promise((r) => setTimeout(r, ms));
const SERVER_URL = "http://localhost:3000";

async function runTest() {
  console.log("🚀 Iniciando Teste de Fluxo Real...");

  // 1. SETUP: Busca usuários no banco (Certifique-se que userA e userB existem)
  const userA = await User.findOne({ where: { username: "userA" } });
  const userB = await User.findOne({ where: { username: "userB" } });

  if (!userA || !userB) {
    console.error("❌ Erro: Usuários não encontrados. Crie 'userA' e 'userB' no Postgres.");
    process.exit(1);
  }

  const tokenB = userB.inbox_token;
  await redisClient.del(`msg:${tokenB}`); // Limpa fila antiga
  console.log(`🧹 Fila limpa para: ${userB.username}`);

  // --- PASSO 1: SENDER ONLINE -> RECEPTOR OFFLINE ---
  console.log("\n📡 Passo 1: UserA enviando mensagens (UserB Offline)...");
  
  const payloads = [
    { toUsername: "userB", cypherText: "Texto Comum", ephemeral: false, time: 1 },
    { toUsername: "userB", cypherText: "Texto Efemero", ephemeral: true, time: 1 }
  ];

  for (const p of payloads) {
    await fetch(`${SERVER_URL}/messages/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p)
    });
  }

  // Verifica se o Redis guardou
  const count = await redisClient.lLen(`msg:${tokenB}`);
  console.log(`📦 Mensagens na fila do Redis: ${count}`);

  // --- PASSO 2: RECONEXÃO E RECEBIMENTO ---
  console.log("\n🌐 Passo 2: UserB conectando via Socket...");
  const socketB = ioc(SERVER_URL);
  let recebidas = [];

  socketB.on("newMessage", (msg) => {
    recebidas.push(msg);
    console.log(`📩 Recebida no Socket: [${msg.cyphertext}] - Efêmera: ${msg.ephemeral}`);
  });

  // O evento que dispara a busca no Redis
  socketB.emit("registerInbox", { inboxToken: tokenB });

  await SLEEP(3000); // Tempo para processar o buffer

  if (recebidas.length === 2) {
    console.log("✅ SUCESSO: Todas as mensagens entregues.");
  } else {
    console.log(`❌ FALHA: Recebeu apenas ${recebidas.length} mensagens.`);
  }

  // --- PASSO 3: ABRIR EFÊMERA E LIMPAR ---
  console.log("\n🔓 Passo 3: Abrindo mensagem efêmera...");
  const msgEfemera = recebidas.find(m => m.ephemeral === true);

  await fetch(`${SERVER_URL}/messages/opened`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inbox_token: tokenB, message: msgEfemera })
  });

  const finalCount = await redisClient.lLen(`msg:${tokenB}`);
  console.log(`📦 Restante no Redis: ${finalCount} (Esperado: 1)`);

  socketB.disconnect();
  process.exit(0);
}

runTest().catch(console.error);
