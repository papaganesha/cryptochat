import { io } from "../server.jss"; // usa o io já criado
import { socketHandlers } from "../socket.jss"; // seus handlers
import { redisClient } from "../redis.jss";
import { sendMessageToInbox } from "../messages.jss"; // função de envio existente

// Tokens simulados
const user1Token = "inbox-user1";
const user2Token = "inbox-user2";

// Mock de sockets para teste (simula clients conectados)
function createMockSocket(token, name) {
  const socket = {
    id: `mock-${name}-${Date.now()}`,
    emit: (event, data) => console.log(`[${name}] emit: ${event}`, data),
    on: (event, callback) => {
      console.log(`[${name}] listener registrado para: ${event}`);
      // Não precisamos chamar callback aqui no mock
    },
  };

  // registra no Redis simulando conexão
  redisClient.set(`socket:${token}`, socket.id);

  // aplica handlers reais
  socketHandlers(socket, io);

  return socket;
}

// Criando mocks
const socket1 = createMockSocket(user1Token, "User1");
const socket2 = createMockSocket(user2Token, "User2");

// Função para enviar mensagens usando sua função existente
async function sendTestMessage(
  fromName,
  toToken,
  ephemeral = false,
  time = 10,
) {
  const ciphertext = `${fromName}-msg-${Date.now()}`;
  const nonce = `nonce-2500`;
  let message = {
    ciphertext,
    nonce,
    ephemeral,
    time,
  };

  await sendMessageToInbox(toToken, message);

  console.log(`${fromName} enviou mensagem para ${toToken}:`, {
    ciphertext,
    ephemeral,
    time,
  });
}

// Cenário de teste
async function runTestScenario() {
  console.log("=== Iniciando teste MVP com handlers reais ===");

  // 1️⃣ User1 envia mensagem normal para User2
  console.log("User1 enviando mensagem normal para User2...");
  await sendTestMessage("User1", user2Token, false, 1);

  // 2️⃣ User1 envia mensagem efêmera para User2
  console.log("User1 enviando mensagem efêmera para User2...");
  await sendTestMessage("User1", user2Token, true, 10);

  // 3️⃣ User2 envia mensagem efêmera para User1
  console.log("User2 enviando mensagem efêmera para User1...");
  await sendTestMessage("User2", user1Token, true, 5);

  // 4️⃣ Simula User2 abrindo efêmera
  console.log("Simulando User2 abrindo efêmera...");
  await io.emit("opened", {
    inboxToken: user2Token,
    message: { ephemeral: true },
  });

  // 5️⃣ Simula desconexão de User2
  console.log("Simulando desconexão de User2...");
  redisClient.del(`socket:${user2Token}`);

  // 6️⃣ Envio de mensagens enquanto User2 está offline
  console.log("Enviando mensagens para User2 enquanto está offline...");
  await sendTestMessage("User1", user2Token, false, 1);
  await sendTestMessage("User1", user2Token, true, 10);

  // 7️⃣ Reconexão de User2
  console.log("Simulando reconexão de User2...");
  createMockSocket(user2Token, "User2");

  // Espera 5s para simular entrega de mensagens pendentes
  await new Promise((r) => setTimeout(r, 5000));

  console.log("=== Teste concluído ===");
  process.exit(0);
}

// Executa o teste
runTestScenario();
