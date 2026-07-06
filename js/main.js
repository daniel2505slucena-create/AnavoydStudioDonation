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
// --- FUNÇÕES DE ATUALIZAÇÃO ---
// ==========================================
function atualizarProgressoGeral() {
    const porcentagem = Math.min((estado.arrecadadoAtual / estado.metaTotal) * 100, 100);
    if(el.currentAmount) el.currentAmount.textContent = formatarMoeda(estado.arrecadadoAtual);
    if(el.percentage) el.percentage.textContent = `${porcentagem.toFixed(2)}%`;
    if(el.progressBar) el.progressBar.style.width = `${porcentagem}%`;
}

function atualizarTierUsuario() {
    let tierAtualNome = "NENHUM";
    let corTier = "#ff4d4d"; // Vermelho padrão
    
    if (estado.totalDoadoPeloUsuario >= 500) { tierAtualNome = "DIAMANTE"; corTier = "#00f2ff"; }
    else if (estado.totalDoadoPeloUsuario >= 100) { tierAtualNome = "PLATINA"; corTier = "#a000ff"; }
    else if (estado.totalDoadoPeloUsuario >= 50) { tierAtualNome = "OURO"; corTier = "#ffd700"; }
    else if (estado.totalDoadoPeloUsuario >= 20) { tierAtualNome = "BRONZE"; corTier = "#cd7f32"; }

    if(el.currentTier) {
        el.currentTier.innerHTML = `SEU TIER ATUAL: <span style="color:${corTier}; font-weight:700;">${tierAtualNome}</span> (TOTAL DOADO: ${formatarMoeda(estado.totalDoadoPeloUsuario)})`;
    }
}

// ==========================================
// --- LÓGICA STEAM ---
// ==========================================
async function efetuarLoginInterface(steamId) {
    estado.logadoSteam = true;
    estado.steamId = steamId;
    localStorage.setItem('steam_user', steamId);

    // Listener tempo real do Usuário no Firestore
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
    
    // Buscar nome (Opcional, busca básica)
    if (el.steamStatus) el.steamStatus.textContent = "USER_AUTENTICADO";
}

function inicializarLoginSteam() {
    el.steamBtn?.addEventListener('click', (e) => {
        if (!estado.logadoSteam) {
            e.preventDefault();
            window.location.href = STEAM_OPENID_URL;
        } else {
            localStorage.removeItem('steam_user');
            window.location.reload();
        }
    });
    
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('openid.identity')) {
        const identityUrl = urlParams.get('openid.identity');
        const steamIdReal = identityUrl.split('/').pop();
        efetuarLoginInterface(steamIdReal);
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// ==========================================
// --- LÓGICA PIX ---
// ==========================================
async function abrirModalPix(valor) {
    if (!estado.logadoSteam) return alert("AUTH_REQUIRED: Faça login na Steam."); 

    estado.valorSelecionadoPix = parseFloat(valor);
    el.pixModal?.classList.remove('hidden');
    el.qrcodeContainer.innerHTML = "GERANDO...";

    try {
        const response = await fetch(`${URL_API}/api/gerar-pix`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ valor: valor })
        });
        const data = await response.json();

        if (data.pixQrCodeBase64) {
            estado.idTransacaoAtual = data.idTransacao;
            el.qrcodeContainer.innerHTML = "";
            new QRCode(el.qrcodeContainer, { text: data.pixCopiaECola, width: 180, height: 180 });
            el.pixKeyDisplay.value = data.pixCopiaECola;
        }
    } catch (e) { alert("ERRO_SERVIDOR"); }
}

// --- BOTÃO CONFIRMAR PAGAMENTO (FIXADO) ---
el.confirmPixBtn?.addEventListener('click', async () => {
    if (!estado.idTransacaoAtual) return;
    
    el.confirmPixBtn.textContent = "VERIFICANDO...";
    
    try {
        // CORREÇÃO: Enviando POST com o steamId para o servidor processar o tier corretamente
        const resposta = await fetch(`${URL_API}/api/verificar-pagamento`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                id: estado.idTransacaoAtual, 
                steamId: estado.steamId 
            })
        });
        
        const resultado = await resposta.json();
        
        if (resultado.pago) {
            alert("SUCESSO: Tier atualizado no sistema.");
            el.pixModal.classList.add('hidden');
        } else {
            alert("Aguardando confirmação bancária...");
            el.confirmPixBtn.textContent = "> CONFIRMAR_PAGAMENTO";
        }
    } catch (e) { 
        alert("Erro na rede."); 
        el.confirmPixBtn.textContent = "> CONFIRMAR_PAGAMENTO";
    }
});

// ==========================================
// --- INICIALIZAÇÃO ---
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    inicializarLoginSteam();
    
    // Listener Global (Meta)
    if (window.db) {
        onSnapshot(doc(window.db, "stats", "global"), (snap) => {
            if (snap.exists()) {
                estado.arrecadadoAtual = parseFloat(snap.data().arrecadado || 0);
                atualizarProgressoGeral();
            }
        });
    }

    const usuarioSalvo = localStorage.getItem('steam_user');
    if (usuarioSalvo) efetuarLoginInterface(usuarioSalvo);
});