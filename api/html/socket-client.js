const SERVER_URL = "http://localhost:3000";
let socket;

// 1. CSS - Garantindo que o visual não quebre
const style = document.createElement('style');
style.innerHTML = `
    .status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 8px; background: #bbb; }
    .online-dot { background: #2ecc71 !important; box-shadow: 0 0 5px #2ecc71; }
    .msg-item { list-style: none; padding: 10px; margin: 8px 0; border-radius: 8px; background: #fff; border: 1px solid #eee; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .blur-text { filter: blur(6px); user-select: none; color: #888; }
    textarea { width: 100%; height: 60px; padding: 8px; border-radius: 6px; border: 1px solid #ccc; resize: none; box-sizing: border-box; }
`;
document.head.appendChild(style);

// 2. Carregamento da Lib Socket.io
const scriptLib = document.createElement("script");
scriptLib.src = `${SERVER_URL}/socket.io/socket.io.js`;
document.head.appendChild(scriptLib);

// --- INICIALIZAÇÃO ---
window.onload = () => {
    if (sessionStorage.getItem("token")) {
        document.getElementById("loginArea").style.display = "none";
        iniciarSocket();
    }
    window.ajustarTTL(false);
};

// --- FUNÇÕES GLOBAIS (Acessíveis pelo HTML) ---

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
        } else {
            alert("Falha no login!");
        }
    } catch (e) { console.error(e); }
};

window.encerrarSessao = () => {
    sessionStorage.clear();
    if (socket) socket.disconnect();
    window.location.reload(); // Reset total da página
};

window.ajustarTTL = (isEfemera) => {
    const select = document.getElementById('ttlSelect');
    if (!select) return;
    select.innerHTML = isEfemera 
        ? '<option value="0.0001">10 Segundos</option><option value="0.0003">30 Segundos</option>'
        : '<option value="1">1 Dia</option><option value="7">7 Dias</option>';
};

window.dispararEnvio = async () => {
    const toUser = document.getElementById('destinatario').value;
    const text = document.getElementById('msgConteudo').value.trim();
    const ttl = document.getElementById('ttlSelect').value;
    const tipo = document.querySelector('input[name="tipoMsg"]:checked').value;
    const isEfemera = (tipo === "efemera");

    if (!text || !toUser) return alert("Preencha destinatário e mensagem!");

    try {
        const res = await fetch(`${SERVER_URL}/messages/send`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'x-authorization': sessionStorage.getItem('token') 
            },
            body: JSON.stringify({ 
                toUsername: toUser, 
                cypherText: text, 
                ephemeral: isEfemera, 
                time: parseFloat(ttl) 
            })
        });

        if (res.ok) {
            renderizarEConfirmar({ cyphertext: text, ephemeral: isEfemera, time: ttl }, "Você");
            document.getElementById('msgConteudo').value = '';
        }
    } catch (e) { console.error(e); }
};

// --- LÓGICA DE CORE (INTERNA) ---

function iniciarSocket() {
    const token = sessionStorage.getItem("token");
    const myInbox = sessionStorage.getItem("inbox_token");
    if (typeof io === "undefined") return setTimeout(iniciarSocket, 500);

    socket = io(SERVER_URL, { auth: { token: token } });

    socket.on("connect", () => {
        socket.emit("registerInbox", { inboxToken: myInbox });
        document.getElementById("status").textContent = `Online: ${sessionStorage.getItem("username")}`;
    });

    socket.on("newMessage", (msg) => processarMensagem(msg));
    socket.on("offlineMessage", (msg) => processarMensagem(msg));
}

function processarMensagem(msg) {
    if (msg.senderUsername) atualizarSidebar(msg.senderUsername);
    renderizarEConfirmar(msg, msg.senderUsername || "Sistema");
}

function renderizarEConfirmar(msg, label) {
    const messagesEl = document.getElementById("messages");
    const li = document.createElement("li");
    li.className = "msg-item";
    const isMine = (label === "Você");
    const displayId = 'id-' + Math.random().toString(36).substr(2, 9);

    if (!msg.ephemeral || isMine) {
        li.innerHTML = `<b>${label}:</b> <span>${msg.cyphertext}</span>`;
        messagesEl.appendChild(li);
        if (!isMine) avisarServidorLido(msg);
    } 
    else {
        li.innerHTML = `
            <b>${label}:</b> 
            <span id="txt-${displayId}" class="blur-text">••••••••••</span>
            <button id="btn-${displayId}" style="cursor:pointer; margin-left:10px;">Abrir</button>
            <small id="tmr-${displayId}" style="color:red; margin-left:10px; font-weight:bold"></small>
        `;
        messagesEl.appendChild(li);

        document.getElementById(`btn-${displayId}`).onclick = function() {
            const span = document.getElementById(`txt-${displayId}`);
            span.innerText = msg.cyphertext;
            span.className = "";
            this.remove();

            avisarServidorLido(msg); // Aqui dispara o LREM no Redis

            let tempo = parseFloat(msg.time) < 1 ? Math.round(msg.time * 86400) : parseInt(msg.time);
            if (!tempo) tempo = 10;

            const timerEl = document.getElementById(`tmr-${displayId}`);
            const intervalo = setInterval(() => {
                if (timerEl) timerEl.innerText = `(${tempo}s)`;
                if (tempo <= 0) {
                    clearInterval(intervalo);
                    li.remove();
                }
                tempo--;
            }, 1000);
        };
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function avisarServidorLido(msg) {
    fetch(`${SERVER_URL}/messages/opened`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json", 
            "x-authorization": sessionStorage.getItem("token") 
        },
        body: JSON.stringify({ 
            inbox_token: sessionStorage.getItem("inbox_token"), 
            message: msg 
        }),
    });
}

function atualizarSidebar(nome) {
    const lista = document.getElementById('listaUsuarios');
    if (!lista || document.getElementById(`btn-user-${nome}`)) return;
    const b = document.createElement('button');
    b.id = `btn-user-${nome}`;
    b.innerHTML = `<span class="status-dot online-dot"></span>${nome}`;
    b.style = "width:100%; text-align:left; padding:10px; margin-bottom:5px; cursor:pointer; border:none; border-radius:5px;";
    b.onclick = () => { document.getElementById('destinatario').value = nome; };
    lista.appendChild(b);
}