// ==========================================
// --- IMPORTAÇÕES FIREBASE ---
// ==========================================
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// ==========================================
// --- CONFIGURAÇÃO DA API ---
// ==========================================
const URL_API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://anavoydstudiodonatebackend.onrender.com';

// ==========================================
// --- ESTADO GLOBAL ---
// ==========================================
let estado = {
    logadoSteam: false,
    steamId: null,
    metaTotal: 50000.00,
    arrecadadoAtual: 0.00,
    totalDoadoPeloUsuario: 0.00,
    valorSelecionadoPix: 0.00,
    verificandoPix: false,
    idTransacaoAtual: null
};

// ==========================================
// --- CONFIGURAÇÃO OPENID STEAM ---
// ==========================================
const URL_DO_SEU_SITE = window.location.origin + window.location.pathname;
const STEAM_OPENID_URL = "https://steamcommunity.com/openid/login" +
    `?openid.ns=http://specs.openid.net/auth/2.0` +
    `&openid.mode=checkid_setup` +
    `&openid.return_to=${encodeURIComponent(URL_DO_SEU_SITE)}` +
    `&openid.realm=${encodeURIComponent(URL_DO_SEU_SITE)}` +
    `&openid.identity=http://specs.openid.net/auth/2.0/identifier_select` +
    `&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select`;

// ==========================================
// --- MAPEAMENTO DO DOM ---
// ==========================================
const el = {
    steamBtn: document.getElementById('steamBtn'),
    steamStatus: document.getElementById('steamStatus'),
    statusIndicator: document.getElementById('statusIndicator'),
    steamWarning: document.getElementById('steamWarning'),
    pixContainer: document.getElementById('pixButtonsContainer'),
    pixButtons: document.querySelectorAll('.btn-pix'),
    pixCustomBtn: document.getElementById('pixCustomBtn'),
    pixModal: document.getElementById('pixModal'),
    closePixBtn: document.getElementById('closePixBtn'),
    qrcodeContainer: document.getElementById('qrcode'),
    pixKeyDisplay: document.getElementById('pixKeyDisplay'),
    confirmPixBtn: document.getElementById('confirmPixBtn'),
    currentAmount: document.getElementById('currentAmount'),
    percentage: document.getElementById('percentage'),
    progressBar: document.getElementById('progress'),
    currentTier: document.getElementById('currentTier')
};

const formatarMoeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ==========================================
// --- FUNÇÕES DE ATUALIZAÇÃO VISUAL ---
// ==========================================
function atualizarProgressoGeral() {
    const porcentagem = Math.min((estado.arrecadadoAtual / estado.metaTotal) * 100, 100);
    if (el.currentAmount) el.currentAmount.textContent = formatarMoeda(estado.arrecadadoAtual);
    if (el.percentage) el.percentage.textContent = `${porcentagem.toFixed(2)}%`;
    if (el.progressBar) el.progressBar.style.width = `${porcentagem}%`;
}

function atualizarTierUsuario() {
    let tier = "NENHUM";
    let cor = "#ff4d4d";
    
    if (estado.totalDoadoPeloUsuario >= 500) { tier = "DIAMANTE"; cor = "#00f2ff"; }
    else if (estado.totalDoadoPeloUsuario >= 100) { tier = "PLATINA"; cor = "#a000ff"; }
    else if (estado.totalDoadoPeloUsuario >= 50) { tier = "OURO"; cor = "#ffd700"; }
    else if (estado.totalDoadoPeloUsuario >= 20) { tier = "BRONZE"; cor = "#cd7f32"; }

    if (el.currentTier) {
        el.currentTier.innerHTML = `SEU TIER ATUAL: <span style="color:${cor}; font-weight:700;">${tier}</span> (TOTAL DOADO: ${formatarMoeda(estado.totalDoadoPeloUsuario)})`;
    }
}

// ==========================================
// --- LÓGICA STEAM ---
// ==========================================
function inicializarLoginSteam() {
    if (el.steamBtn) {
        el.steamBtn.addEventListener('click', (e) => {
            if (!estado.logadoSteam) {
                e.preventDefault();
                window.location.href = STEAM_OPENID_URL;
            } else {
                localStorage.removeItem('steam_user');
                window.location.reload();
            }
        });
    }

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('openid.identity')) {
        const steamId = urlParams.get('openid.identity').split('/').pop();
        efetuarLoginInterface(steamId);
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

async function efetuarLoginInterface(steamId) {
    estado.logadoSteam = true;
    estado.steamId = steamId;
    localStorage.setItem('steam_user', steamId);

    // Snapshot do Firestore para o usuário
    if (window.db) {
        const userRef = doc(window.db, "users", steamId);
        onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                estado.totalDoadoPeloUsuario = parseFloat(docSnap.data().totalDoado || 0);
                atualizarTierUsuario();
            }
        });
    }

    if (el.steamBtn) el.steamBtn.textContent = "[ LOGOUT ]";
    if (el.steamWarning) el.steamWarning.classList.add('hidden');
    if (el.pixContainer) el.pixContainer.classList.remove('disabled');
    if (el.statusIndicator) {
        el.statusIndicator.classList.remove('offline');
        el.statusIndicator.classList.add('online');
    }
    if (el.steamStatus) el.steamStatus.textContent = "USER_AUTENTICADO";
}

// ==========================================
// --- LÓGICA PIX ---
// ==========================================
async function abrirModalPix(valor) {
    if (!estado.logadoSteam) return alert("AUTH_REQUIRED: Faça login na Steam.");

    estado.valorSelecionadoPix = parseFloat(valor);
    if (el.pixModal) el.pixModal.classList.remove('hidden');
    if (el.qrcodeContainer) el.qrcodeContainer.innerHTML = "GERANDO...";

    try {
        const response = await fetch(`${URL_API}/api/gerar-pix`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ valor: valor })
        });
        const data = await response.json();

        if (data.pixQrCodeBase64) {
            estado.idTransacaoAtual = data.idTransacao;
            if (el.qrcodeContainer) el.qrcodeContainer.innerHTML = "";
            new QRCode(el.qrcodeContainer, { text: data.pixCopiaECola, width: 180, height: 180 });
            if (el.pixKeyDisplay) el.pixKeyDisplay.value = data.pixCopiaECola;
        }
    } catch (e) {
        alert("ERRO_SERVIDOR");
        if (el.pixModal) el.pixModal.classList.add('hidden');
    }
}

function fecharModalPix() {
    if (el.pixModal) el.pixModal.classList.add('hidden');
    estado.verificandoPix = false;
    estado.idTransacaoAtual = null;
}

// ==========================================
// --- EVENT LISTENERS ---
// ==========================================
// Botões fixos 20, 50, 100
el.pixButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (e.target.id !== 'pixCustomBtn') {
            abrirModalPix(e.target.getAttribute('data-amount'));
        }
    });
});

// Botão Custom
if (el.pixCustomBtn) {
    el.pixCustomBtn.addEventListener('click', () => {
        const val = prompt("Digite o valor:", "25,00");
        if (val) abrirModalPix(parseFloat(val.replace(',', '.')));
    });
}

// Botão Fechar Modal
if (el.closePixBtn) el.closePixBtn.addEventListener('click', fecharModalPix);

// Botão Confirmar Pagamento
if (el.confirmPixBtn) {
    el.confirmPixBtn.addEventListener('click', async () => {
        if (!estado.idTransacaoAtual) return;
        el.confirmPixBtn.textContent = "VERIFICANDO...";
        
        try {
            const resposta = await fetch(`${URL_API}/api/verificar-pagamento`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: estado.idTransacaoAtual, steamId: estado.steamId })
            });
            const res = await resposta.json();
            
            if (res.pago) {
                alert("SUCESSO: Tier atualizado.");
                fecharModalPix();
            } else {
                alert("Aguardando confirmação...");
                el.confirmPixBtn.textContent = "> CONFIRMAR_PAGAMENTO";
            }
        } catch (e) {
            alert("Erro na rede.");
            el.confirmPixBtn.textContent = "> CONFIRMAR_PAGAMENTO";
        }
    });
}

// Clipboard
if (el.pixKeyDisplay) {
    el.pixKeyDisplay.addEventListener('click', () => {
        navigator.clipboard.writeText(el.pixKeyDisplay.value);
        alert("COPIADO!");
    });
}

// ==========================================
// --- INICIALIZAÇÃO ---
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    inicializarLoginSteam();
    
    // Listener Global Firestore
    if (window.db) {
        onSnapshot(doc(window.db, "stats", "global"), (snap) => {
            if (snap.exists()) {
                estado.arrecadadoAtual = parseFloat(snap.data().arrecadado || 0);
                atualizarProgressoGeral();
            }
        });
    }

    const user = localStorage.getItem('steam_user');
    if (user) efetuarLoginInterface(user);
});