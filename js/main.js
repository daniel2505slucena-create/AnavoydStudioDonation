/**
 * MAIN.JS - SISTEMA DE DOAÇÃO E TIER STEAM
 * VERSÃO COMPLETA E DETALHADA
 */

import { 
    doc, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// ==================================================================================
// CONFIGURAÇÕES DE AMBIENTE
// ==================================================================================
const URL_API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://anavoydstudiodonatebackend.onrender.com';

// ==================================================================================
// ESTADO GLOBAL DA APLICAÇÃO
// ==================================================================================
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

// ==================================================================================
// CONFIGURAÇÃO OPENID STEAM
// ==================================================================================
const URL_DO_SEU_SITE = window.location.origin + window.location.pathname;
const STEAM_OPENID_URL = "https://steamcommunity.com/openid/login" +
    `?openid.ns=http://specs.openid.net/auth/2.0` +
    `&openid.mode=checkid_setup` +
    `&openid.return_to=${encodeURIComponent(URL_DO_SEU_SITE)}` +
    `&openid.realm=${encodeURIComponent(URL_DO_SEU_SITE)}` +
    `&openid.identity=http://specs.openid.net/auth/2.0/identifier_select` +
    `&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select`;

// ==================================================================================
// MAPEAMENTO DOS ELEMENTOS DO DOM
// ==================================================================================
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

// ==================================================================================
// FUNÇÕES UTILITÁRIAS DE FORMATAÇÃO
// ==================================================================================
function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ==================================================================================
// FUNÇÕES DE ATUALIZAÇÃO DA INTERFACE (UI)
// ==================================================================================
function atualizarProgressoGeral() {
    console.log("Atualizando barra de progresso:", estado.arrecadadoAtual);
    const porcentagem = Math.min((estado.arrecadadoAtual / estado.metaTotal) * 100, 100);
    
    if(el.currentAmount) el.currentAmount.textContent = formatarMoeda(estado.arrecadadoAtual);
    if(el.percentage) el.percentage.textContent = `${porcentagem.toFixed(2)}%`;
    if(el.progressBar) el.progressBar.style.width = `${porcentagem}%`;
}

function atualizarTierUsuario() {
    console.log("Atualizando tier visual. Total doado:", estado.totalDoadoPeloUsuario);
    let tierAtualNome = "NENHUM";
    let corTier = "#ff4d4d";
    
    if (estado.totalDoadoPeloUsuario >= 500) { tierAtualNome = "DIAMANTE"; corTier = "#00f2ff"; }
    else if (estado.totalDoadoPeloUsuario >= 100) { tierAtualNome = "PLATINA"; corTier = "#a000ff"; }
    else if (estado.totalDoadoPeloUsuario >= 50) { tierAtualNome = "OURO"; corTier = "#ffd700"; }
    else if (estado.totalDoadoPeloUsuario >= 20) { tierAtualNome = "BRONZE"; corTier = "#cd7f32"; }

    if(el.currentTier) {
        el.currentTier.innerHTML = `SEU TIER ATUAL: <span style="color:${corTier}; font-weight:700;">${tierAtualNome}</span> (TOTAL DOADO: ${formatarMoeda(estado.totalDoadoPeloUsuario)})`;
    }
}

// ==================================================================================
// LÓGICA DE LOGIN STEAM E AUTENTICAÇÃO
// ==================================================================================
function efetuarLoginInterface(steamId) {
    console.log("Autenticando usuário na interface:", steamId);
    estado.logadoSteam = true;
    estado.steamId = steamId;
    localStorage.setItem('steam_user', steamId);

    // Listener do Firestore para dados específicos do usuário
    if (window.db) {
        const userRef = doc(window.db, "users", steamId);
        onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                estado.totalDoadoPeloUsuario = parseFloat(docSnap.data().totalDoado || 0);
                atualizarTierUsuario();
            }
        });
    }

    // Atualiza os elementos visuais
    if (el.steamBtn) el.steamBtn.textContent = "[ LOGOUT ]";
    if (el.steamWarning) el.steamWarning.classList.add('hidden');
    if (el.pixContainer) el.pixContainer.classList.remove('disabled');
    if (el.statusIndicator) {
        el.statusIndicator.classList.remove('offline');
        el.statusIndicator.classList.add('online');
    }
    if (el.steamStatus) el.steamStatus.textContent = "USER_AUTENTICADO";
}

function inicializarLoginSteam() {
    // Configura o evento do botão de login
    el.steamBtn?.addEventListener('click', (e) => {
        if (!estado.logadoSteam) {
            e.preventDefault();
            window.location.href = STEAM_OPENID_URL;
        } else {
            localStorage.removeItem('steam_user');
            window.location.reload();
        }
    });
    
    // Verifica retorno da Steam
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('openid.identity')) {
        const identityUrl = urlParams.get('openid.identity');
        const steamIdReal = identityUrl.split('/').pop();
        efetuarLoginInterface(steamIdReal);
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// ==================================================================================
// LÓGICA DE PIX E MODAL (COM TRATAMENTO DE ERROS E LIMPEZA)
// ==================================================================================
async function abrirModalPix(valor) {
    if (!estado.logadoSteam) {
        alert("AUTH_REQUIRED: Faça login na Steam para doar.");
        return;
    }

    estado.valorSelecionadoPix = parseFloat(valor);
    el.pixModal?.classList.remove('hidden');
    el.qrcodeContainer.innerHTML = "GERANDO QR CODE...";

    try {
        const response = await fetch(`${URL_API}/api/gerar-pix`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ valor: valor })
        });
        const data = await response.json();

        if (data.pixCopiaECola) {
            // LIMPEZA DA STRING PIX (TRIM) - Essencial para evitar erros de leitura no banco
            const codigoLimpo = data.pixCopiaECola.trim();
            
            estado.idTransacaoAtual = data.idTransacao;
            el.qrcodeContainer.innerHTML = "";
            
            // Gerador de QRCode com alta precisão
            new QRCode(el.qrcodeContainer, { 
                text: codigoLimpo, 
                width: 200, 
                height: 200,
                correctLevel: QRCode.CorrectLevel.Q 
            });
            
            el.pixKeyDisplay.value = codigoLimpo;
        }
    } catch (e) { 
        alert("ERRO_SERVIDOR: Não foi possível gerar o código Pix.");
        console.error("Erro na geração Pix:", e);
    }
}

function fecharModalPix() {
    if (el.pixModal) el.pixModal.classList.add('hidden');
    estado.idTransacaoAtual = null;
    el.qrcodeContainer.innerHTML = "";
}

// ==================================================================================
// EVENT LISTENERS E GERENCIAMENTO DE INTERAÇÃO
// ==================================================================================

// Eventos dos botões fixos 20, 50, 100
el.pixButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetBtn = e.currentTarget;
        if (targetBtn.id !== 'pixCustomBtn') {
            const valor = targetBtn.getAttribute('data-amount');
            if (valor) abrirModalPix(valor);
        }
    });
});

// Botão Custom
el.pixCustomBtn?.addEventListener('click', () => {
    const val = prompt("Digite o valor da doação:", "25,00");
    if (val) abrirModalPix(parseFloat(val.replace(',', '.')));
});

// Botão Confirmar Pagamento (Verificação no servidor)
el.confirmPixBtn?.addEventListener('click', async () => {
    if (!estado.idTransacaoAtual) return;
    
    el.confirmPixBtn.textContent = "VERIFICANDO...";
    
    try {
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
            alert("SUCESSO: Pagamento confirmado e Tier atualizado!");
            fecharModalPix();
        } else {
            alert("Aguardando confirmação bancária...");
            el.confirmPixBtn.textContent = "> CONFIRMAR_PAGAMENTO";
        }
    } catch (e) { 
        alert("Erro na rede. Verifique sua conexão."); 
        el.confirmPixBtn.textContent = "> CONFIRMAR_PAGAMENTO";
    }
});

// Fechar Modal
el.closePixBtn?.addEventListener('click', fecharModalPix);

// Copiar Chave
el.pixKeyDisplay?.addEventListener('click', () => {
    navigator.clipboard.writeText(el.pixKeyDisplay.value);
    alert("COPIADO PARA O CLIPBOARD!");
});

// ==================================================================================
// INICIALIZAÇÃO DA PÁGINA (FIREBASE & EVENTOS)
// ==================================================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Carregado, iniciando sistema...");
    
    // 1. Inicializar Steam
    inicializarLoginSteam();
    
    // 2. Listener Global de Metas (Firestore)
    if (window.db) {
        onSnapshot(doc(window.db, "stats", "global"), (snap) => {
            if (snap.exists()) {
                estado.arrecadadoAtual = parseFloat(snap.data().arrecadado || 0);
                atualizarProgressoGeral();
            }
        });
    }

    // 3. Verificar sessão salva
    const usuarioSalvo = localStorage.getItem('steam_user');
    if (usuarioSalvo) {
        efetuarLoginInterface(usuarioSalvo);
    }
});