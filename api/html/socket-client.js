const SERVER_URL = "http://localhost:3000";
let socket;

// 1. INJETA CSS AUTOMATICAMENTE (Para garantir que você VEJA a bolinha e o check)
const style = document.createElement('style');
style.innerHTML = `
    .status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 8px; background: #bbb; transition: 0.3s; }
    .online-dot { background: #2ecc71 !important; box-shadow: 0 0 5px #2ecc71; }
    .msg-item { list-style: none; padding: 8px; margin: 5px 0; border-radius: 5px; background: #fff; border: 1px solid #eee; }
    .check-lido { font-size: 0.8em; margin-left: 5px; color: #bbb; transition: 0.3s; }
    .lido-blue { color: #3498db !important; }
`;
document.head.appendChild(style);

// CARREGAMENTO DA LIB
const scriptLib = document.createElement("script");
scriptLib.src = `${SERVER_URL}/socket.io/socket.io.js`;
document.head.appendChild(scriptLib);

window.onload = () => {
  if (sessionStorage.getItem("token")) {
    document.getElementById("loginArea").style.display = "none";
    iniciarSocket();
  }
};

window.ajustarTTL = (isEfemera) => {
  const select = document.getElementById('ttlSelect');
  if (!select) return;
  select.innerHTML = isEfemera 
      ? '<option value="5">5 Segundos</option><option value="15">15 Segundos</option><option value="30">30 Segundos</option>'
      : '<option value="86400">1 Dia</option><option value="259200">3 Dias</option><option value="604800">7 Dias</option>';
};

window.realizarAcesso = async () => {
  const username = document.getElementById("user").value;
  const password = document.getElementById("pass").value;
  try {
    const res = await fetch(`${SERVER_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (data.token) {
      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("username", data.username);
      sessionStorage.setItem("inbox_token", data.inbox_token);
      document.getElementById("loginArea").style.display = "none";
      iniciarSocket();
    }
  } catch (e) { console.error(e); }
};

window.dispararEnvio = async () => {
  const toUser = document.getElementById('destinatario').value;
  const text = document.getElementById('msgConteudo').value.trim();
  const jwt = sessionStorage.getItem('token'); 
  const ttl = document.getElementById('ttlSelect').value;
  // Captura se é efêmera ou comum
  const isEfemera = document.querySelector('input[name="tipoMsg"]:checked').value === "efemera";

  if (!jwt || !text || !toUser) return alert("Preencha tudo!");

  try {
      const response = await fetch(`${SERVER_URL}/messages/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-authorization': jwt },
          body: JSON.stringify({
              toUsername: toUser, 
              cypherText: text,
              nonce: "n_" + Date.now(),
              ephemeral: isEfemera,
              time: parseInt(ttl) 
          })
      });

      if (response.ok) {
          const resData = await response.json();
          atualizarSidebar(toUser);
          // RENDERIZAÇÃO LOCAL (Enviada por mim)
          renderizarEConfirmar({ id: resData.id, cyphertext: text, ephemeral: isEfemera, time: ttl }, "Você");
          document.getElementById('msgConteudo').value = '';
      }
  } catch (e) { console.error(e); }
};

function iniciarSocket() {
  const token = sessionStorage.getItem("token");
  const myInbox = sessionStorage.getItem("inbox_token");
  if (typeof io === "undefined") return setTimeout(iniciarSocket, 500);

  socket = io(SERVER_URL, { auth: { token: token } });

  socket.on("connect", () => {
    socket.emit("registerInbox", { inboxToken: myInbox });
    document.getElementById("status").textContent = `Online: ${sessionStorage.getItem("username")}`;
  });

  // ESCUTA STATUS ONLINE (Bolinha)
  socket.on("userStatus", ({ username, online }) => {
    const dot = document.getElementById(`dot-${username}`);
    if (dot) {
        if (online) dot.classList.add("online-dot");
        else dot.classList.remove("online-dot");
    }
  });

  // ESCUTA CHECK AZUL
  socket.on("messageRead", ({ messageId }) => {
    const check = document.getElementById(`check-${messageId}`);
    if (check) {
        check.classList.add("lido-blue");
        check.textContent = " ✓✓";
    }
  });

  socket.on("message", (msg) => {
      if (msg.senderUsername) atualizarSidebar(msg.senderUsername);
      renderizarEConfirmar(msg, msg.senderUsername || "Sistema");
  });
}

function atualizarSidebar(nomeUsuario) {
    const lista = document.getElementById('listaUsuarios');
    if (!lista || document.getElementById(`btn-${nomeUsuario}`)) return;
    const btn = document.createElement('button');
    btn.id = `btn-${nomeUsuario}`;
    btn.innerHTML = `<span id="dot-${nomeUsuario}" class="status-dot"></span>${nomeUsuario}`;
    btn.style = "width:100%; margin-bottom:5px; padding:8px; cursor:pointer; text-align:left; border:none; background:#eee; border-radius:5px;";
    btn.onclick = () => { document.getElementById('destinatario').value = nomeUsuario; };
    lista.appendChild(btn);
}

async function renderizarEConfirmar(msg, label) {
  const messagesEl = document.getElementById("messages");
  const li = document.createElement("li");
  li.className = "msg-item";
  const msgId = msg.id || `msg-${Math.random().toString(36).substr(2, 9)}`;
  li.id = msgId;

  const isMine = (label === "Você");
  const checkHtml = isMine ? `<span id="check-${msgId}" class="check-lido"> ✓</span>` : "";

  // --- LÓGICA DE SEPARAÇÃO REAL ---
  
  // 1. Se a mensagem NÃO for efêmera (Comum) OU se fui eu que enviei:
  if (msg.ephemeral === false || msg.ephemeral === "false" || isMine) {
    // APARECE ABERTA DIRETO
    li.innerHTML = `<b>${label}:</b> <span>${msg.cyphertext || msg.content}</span>${checkHtml}`;
    messagesEl.appendChild(li);
    
    // Inicia timer longo (1-7 dias) em background
    iniciarTimer(li, msg.time, msgId, false);
    
    // Se eu recebi uma comum, já marco como lido no servidor
    if (!isMine) notificarLido(msg);
  } 
  // 2. Se for EFÊMERA e RECEBIDA:
  else {
    // APARECE COM CADEADO
    li.innerHTML = `
        <b>${label}:</b> <span id="txt-${msgId}" style="color:#777; font-style:italic">🔒 Mensagem de Visualização Única</span>
        <button id="btn-${msgId}" style="cursor:pointer; margin-left:10px; font-size:10px; border-radius:4px;">Abrir</button>
        <small id="timer-${msgId}" style="color:red; margin-left:5px"></small>
    `;
    messagesEl.appendChild(li);

    document.getElementById(`btn-${msgId}`).onclick = function() {
        // REVELA O TEXTO AO CLICAR
        document.getElementById(`txt-${msgId}`).innerText = msg.cyphertext || msg.content;
        document.getElementById(`txt-${msgId}`).style = "color:#000; font-style:normal";
        this.remove(); // Some o botão 'Abrir'
        
        notificarLido(msg);
        iniciarTimer(li, msg.time, msgId, true); // Timer curto (5s-30s) inicia agora
    };
  }
  
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function notificarLido(msg) {
    fetch(`${SERVER_URL}/messages/opened`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-authorization": sessionStorage.getItem("token") },
        body: JSON.stringify({ inbox_token: sessionStorage.getItem("inbox_token"), message: msg }),
    });
    // Avisa o remetente para ele ver o check azul
    if(socket) socket.emit("markRead", { messageId: msg.id, toInbox: msg.senderInboxToken });
}

function iniciarTimer(elemento, segundos, msgId, exibirContagem) {
    if (!segundos || segundos <= 0) return;
    let restante = segundos;
    const display = document.getElementById(`timer-${msgId}`);

    const intervalo = setInterval(() => {
        if (exibirContagem && display) display.innerText = `(${restante}s)`;
        if (restante <= 0) {
            clearInterval(intervalo);
            if (elemento) {
                elemento.style.opacity = '0';
                elemento.style.transition = 'opacity 0.8s';
                setTimeout(() => elemento.remove(), 800);
            }
        }
        restante--;
    }, 1000);
}
