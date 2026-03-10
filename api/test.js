import { io as ioc } from "socket.io-client";
import { redisClient } from "./redis.js";
import { sendMessageToInbox, markMessageOpened } from "./messages.js";

const SLEEP = (ms) => new Promise((r) => setTimeout(r, ms));

async function runRealTest() {
  console.log("🚀 Iniciando Teste de Integração Real...");

  const SERVER_URL = "http://localhost:3000";
  const user1Token = "inbox_real_1";
  const user2Token = "inbox_real_2";

  // 1. Limpar Redis para o teste ser limpo
  await redisClient.del(`msg:${user2Token}`);
  await redisClient.del(`socket:${user2Token}`);

  // 2. Criar Cliente 1 (User 1)
  const client1 = ioc(SERVER_URL);
  
  client1.on("connect", () => {
    console.log("✅ User 1 conectado via Socket Real!");
    client1.emit("registerInbox", { inboxToken: user1Token });
  });

  // 3. Simular User 2 OFFLINE e enviar mensagens para ele
  console.log("📡 User 2 está offline. Enviando mensagens pendentes...");
  
  await sendMessageToInbox(user2Token, { 
    cyphertext: "msg_offline_1", 
    ephemeral: false, 
    time: 1 
  });
  await sendMessageToInbox(user2Token, { 
    cyphertext: "msg_offline_efemera", 
    ephemeral: true, 
    time: 1 
  });

  await SLEEP(1000);

  // 4. Criar Cliente 2 (User 2) - Conexão tardia
  console.log("🌐 User 2 conectando agora para recuperar mensagens...");
  const client2 = ioc(SERVER_URL);
  
  let messagesReceived = 0;
  client2.on("newMessage", (data) => {
    messagesReceived++;
    console.log(`📩 User 2 recebeu: [${data.cyphertext}] (Total: ${messagesReceived})`);
  });

  client2.on("connect", () => {
    client2.emit("registerInbox", { inboxToken: user2Token });
  });

  // 5. Esperar processamento
  await SLEEP(3000);

  // 6. Verificação de Integridade
  if (messagesReceived === 2) {
    console.log("✨ SUCESSO: Todas as mensagens pendentes foram entregues na reconexão.");
  } else {
    console.error(`❌ FALHA: Esperava 2 mensagens, mas recebeu ${messagesReceived}.`);
  }

  // 7. Testar Efemeridade (Limpeza)
  console.log("🗑️ Testando se a mensagem efêmera some do Redis após 'abrir'...");
  // Simulando a chamada que o seu controller faria
  const mockMsgEfemera = { cyphertext: "msg_offline_efemera", ephemeral: true };
  
  // Importamos a função de marcação diretamente para o teste
  await markMessageOpened(user2Token, mockMsgEfemera);

  const remainingMsgs = await redisClient.lRange(`msg:${user2Token}`, 0, -1);
  console.log(`📦 Mensagens restantes no Redis: ${remainingMsgs.length}`);

  if (remainingMsgs.length === 1) {
    console.log("✅ Efemeridade funcionando: Mensagem removida do Redis.");
  }

  console.log("🏁 Teste concluído. Fechando conexões...");
  client1.disconnect();
  client2.disconnect();
  process.exit(0);
}

runRealTest().catch(console.error);
