// ==========================================
// --- CONFIGURAÇÃO DINÂMICA DA API ---
// ==========================================
const URL_API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://anavoydstudiodonatebackend.onrender.com';

// ==========================================
// --- ESTADO GLOBAL DA APLICAÇÃO ---
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
// --- ELEMENTOS DO DOM ---
// ==========================================
const el = {
    steamBtn: document.getElementById('steamBtn'),
    steamStatus: document.getElementById('steamStatus'),
    statusIndicator: document.getElementById('statusIndicator'),
    steamWarning: document.getElementById('steamWarning'),
    pixContainer: document.getElementById('pixButtonsContainer'),
    pixButtons: document.querySelectorAll('.btn-pix'), // Ajustado para a classe Cyberpunk
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
// --- PERSISTÊNCIA REAL DE DADOS ---
// ==========================================
async function carregarDadosEProgresso() {
    let salvoUsuario = localStorage.getItem('usuario_total_doado');
    estado.totalDoadoPeloUsuario = salvoUsuario ? parseFloat(salvoUsuario) : 0.00;

    try {
        const resposta = await fetch(`${URL_API}/api/meta-progresso`);
        const dados = await resposta.json();
        estado.arrecadadoAtual = parseFloat(dados.arrecadadoAtual || 0);
    } catch (e) {
        console.error("Erro ao buscar progresso do servidor, usando backup local:", e);
        let backupGlobal = localStorage.getItem('meta_global_arrecadada');
        estado.arrecadadoAtual = backupGlobal ? parseFloat(backupGlobal) : 0.00;
    }
    
    atualizarProgressoGeral();
    atualizarTierUsuario();
}

// ==========================================
// --- FUNÇÕES DE PROGRESSO ---
// ==========================================
function atualizarProgressoGeral() {
    const porcentagem = Math.min((estado.arrecadadoAtual / estado.metaTotal) * 100, 100);
    if(el.currentAmount) el.currentAmount.textContent = formatarMoeda(estado.arrecadadoAtual);
    if(el.percentage) el.percentage.textContent = `${porcentagem.toFixed(2)}%`;
    if(el.progressBar) el.progressBar.style.width = `${porcentagem}%`;
}

function atualizarTierUsuario() {
    let tierAtualNome = "NENHUM";
    let corTier = "var(--alert-red)";
    
    if (estado.totalDoadoPeloUsuario >= 500) { tierAtualNome = "DIAMANTE"; corTier = "var(--neon-purple)"; }
    else if (estado.totalDoadoPeloUsuario >= 100) { tierAtualNome = "PLATINA"; corTier = "var(--neon-purple)"; }
    else if (estado.totalDoadoPeloUsuario >= 50) { tierAtualNome = "OURO"; corTier = "var(--neon-green)"; }
    else if (estado.totalDoadoPeloUsuario >= 20) { tierAtualNome = "BRONZE"; corTier = "var(--neon-green)"; }

    if(el.currentTier) {
        el.currentTier.innerHTML = `SEU TIER ATUAL: <span style="color:${corTier}; font-weight:700;">${tierAtualNome}</span> (TOTAL DOADO: ${formatarMoeda(estado.totalDoadoPeloUsuario)})`;
    }
}

// ==========================================
// --- AUTENTICAÇÃO STEAM ---
// ==========================================
function inicializarLoginSteam() {
    if (el.steamBtn && !estado.logadoSteam) el.steamBtn.onclick
}