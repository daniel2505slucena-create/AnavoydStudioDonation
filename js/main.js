/**
 * MAIN.JS - SISTEMA DE DOAÇÃO E TIER STEAM
 * VERSÃO DEFINITIVA CORRIGIDA - SEM DUPLICAÇÕES
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
    steamName: "Carregando...", 
    metaTotal: 50000.00,
    arrecadadoAtual: 0.00,
    totalDoadoPeloUsuario: 0.00,
    valorSelecionadoPix: 0.00,
    verificandoPix: false,
    idTransacaoAtual: null
};

// Travas para impedir duplicação de leitura no Firebase
let listenerGlobalRegistrado = false;
let listenerUsuarioRegistrado = false;

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
// MAPEAMENTO DOS ELEMENTOS DO DOM (COM FALLBACK PARA EVITAR ERRO DE ID)
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
    currentAmount: document.getElementById('currentAmount') || document.getElementById('arrecadado'),
    percentage: document.getElementById('percentage') || document.getElementById('porcentagem'),
    progressBar: document.getElementById('progress') || document.getElementById('progressBar') || document.querySelector('.progress-bar'),
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
    const porcentagem = Math.min((estado.arrecadadoAtual / estado.metaTotal) * 100, 100);
    
    if (el.currentAmount) el.currentAmount.textContent = formatarMoeda(estado.arrecadadoAtual);
    if (el.percentage) el.percentage.textContent = `${porcentagem.toFixed(2)}%`;
    if (el.progressBar) {
        el.progressBar.style.width = `${porcentagem}%`;
        if (estado.arrecadadoAtual > 0 && porcentagem < 1) {
            el.progressBar.style.width = "1%";
        }
    }
}

function atualizarTierUsuario() {
    let tierAtualNome = "NENHUM";
    let corTier = "#6b7280"; 
    
    if (estado.totalDoadoPeloUsuario >= 500) { tierAtualNome = "DIAMANTE"; corTier = "#00f2ff"; }
    else if (estado.totalDoadoPeloUsuario >= 100) { tierAtualNome = "PLATINA"; corTier = "#00ff62"; }
    else if (estado.totalDoadoPeloUsuario >= 50) { tierAtualNome = "OURO"; corTier = "#ffd700"; }
    else if (estado.totalDoadoPeloUsuario >= 20) { tierAtualNome = "BRONZE"; corTier = "#cd7f32"; }

    if (el.currentTier) {
        el.currentTier.innerHTML = `
            <div style="margin-bottom: 0.5rem; border-bottom: 1px solid var(--panel-border); padding-bottom: 0.5rem;">
                <span style="color: var(--text-muted);">SISTEMA_USER:</span> ${estado.steamName}<br>
                <span style="color: var(--text-muted);">STEAM_ID:</span> <small style="font-size: 11px;">${estado.steamId || '---'}</small>
            </div>
            <div>SEU TIER ATUAL: <span style="color:${corTier}; font-weight:700;">${tierAtualNome}</span></div>
            <div style="font-size: 0.9rem; margin-top: 0.3rem;">TOTAL CONTRIBUÍDO: <span class="highlight-green">${formatarMoeda(estado.totalDoadoPeloUsuario)}</span></div>
        `;
    }
}

// ==================================================================================
// CONEXÃO COM O FIREBASE (SEM DUPLICAÇÃO DE LEITURA)
// ==================================================================================
function conectarFirebase() {
    if (!window.db) {
        setTimeout(conectarFirebase, 100);
        return;
    }

    if (!listenerGlobalRegistrado) {
        listenerGlobalRegistrado = true;
        onSnapshot(doc(window.db, "stats", "global"), (snap) => {
            if (snap.exists()) {
                estado.arrecadadoAtual = parseFloat(snap.data().arrecadado || 0);
                atualizarProgressoGeral();
            }
        });
    }

    if (estado.steamId && !listenerUsuarioRegistrado) {
        listenerUsuarioRegistrado = true;
        const userRef = doc(window.db, "users", estado.steamId);
        onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                estado.totalDoadoPeloUsuario = parseFloat(docSnap.data().totalDoado || 0);
                atualizarTierUsuario();
            }
        });
    }
}

// ==================================================================================
// LÓGICA DE LOGIN STEAM E AUTENTICAÇÃO
// ==================================================================================
function efetuarLoginInterface(steamId) {
    estado.logadoSteam = true;
    estado.steamId = steamId;
    localStorage.setItem('steam_user', steamId);

    conectarFirebase();

    if (el.steamBtn) el.steamBtn.textContent = "[ LOGOUT ]";
    if (el.steamWarning) el.steamWarning.classList.add('hidden');
    if (el.pixContainer) el.pixContainer.classList.remove('disabled');
    if (el.statusIndicator) {
        el.statusIndicator.classList.remove('offline');
        el.statusIndicator.classList.add('online');
    }
    
    estado.steamName = "Carregando perfil...";
    if (el.steamStatus) el.steamStatus.textContent = estado.steamName;

    atualizarTierUsuario();

    // Faz a requisição em segundo plano para não travar a tela se a Render estiver dormindo
    fetch(`${URL_API}/api/steam-perfil/${steamId}`)
        .then(resposta => resposta.json())
        .then(dadosSteam => {
            estado.steamName = dadosSteam.steamName || "Usuário Steam";
            if (el.steamStatus) el.steamStatus.textContent = estado.steamName;
            atualizarTierUsuario(); 
        })
        .catch(e => {
            console.error("Não foi possível carregar o nome da Steam:", e);
            estado.steamName = "Usuário Steam";
            if (el.steamStatus) el.steamStatus.textContent = estado.steamName;
            atualizarTierUsuario();
        });
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

// ==================================================================================
// LÓGICA DE PIX E MODAL (COM QR CODE UNIVERSAL)
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
            const codigoLimpo = data.pixCopiaECola.trim();
            estado.idTransacaoAtual = data.idTransacao;
            el.qrcodeContainer.innerHTML = "";
            
            const QRCodeLib = window.QRCode || typeof QRCode !== 'undefined' ? (window.QRCode || QRCode) : null;
            
            if (QRCodeLib) {
                new QRCodeLib(el.qrcodeContainer, { 
                    text: codigoLimpo, 
                    width: 200, 
                    height: 200,
                    correctLevel: QRCodeLib.CorrectLevel ? QRCodeLib.CorrectLevel.Q : 2
                });
            } else {
                el.qrcodeContainer.innerHTML = "Erro ao carregar renderizador QR.";
            }
            
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
    if (el.qrcodeContainer) el.qrcodeContainer.innerHTML = "";
}

// ==================================================================================
// EVENT LISTENERS E GERENCIAMENTO DE INTERAÇÃO
// ==================================================================================
el.pixButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetBtn = e.currentTarget;
        if (targetBtn.id !== 'pixCustomBtn') {
            const valor = targetBtn.getAttribute('data-amount');
            if (valor) abrirModalPix(valor);
        }
    });
});

el.pixCustomBtn?.addEventListener('click', () => {
    const val = prompt("Digite o valor da doação:", "25,00");
    if (val) abrirModalPix(parseFloat(val.replace(',', '.')));
});

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
            // Transforma o modal do Pix na tela de sucesso com o seu link do Discord
            const modalContent = document.querySelector('#pixModal .modal-content');
            if (modalContent) {
                modalContent.innerHTML = `
                    <div class="modal-header">
                        <h3>> UPLINK_SUCESSO</h3>
                        <button onclick="window.location.reload()" class="close-btn">[X]</button>
                    </div>
                    <div style="text-align: center; padding: 1.5rem 0;">
                        <span class="status-indicator online" style="display: inline-block; margin-bottom: 1rem;"></span>
                        <p class="highlight-green" style="font-size: 1.3rem; font-weight: 700; margin-bottom: 1rem; letter-spacing: 2px;">
                            > ACESSO_CONCEDIDO
                        </p>
                        <p style="color: var(--text-main); margin-bottom: 2rem; font-size: 0.9rem;">
                            SEU PIX FOI CONFIRMADO E SEU TIER JÁ FOI ATUALIZADO COM SUCESSO.
                        </p>
                        
                        <a href="https://discord.gg/3AExjcdCvp" target="_blank" class="cyber-btn confirm-btn" style="display: block; text-decoration: none; text-align: center; padding: 1rem; background: var(--bg-base); border-color: var(--accent-gold); color: var(--accent-gold);">
                            > ENTRAR_NO_SERVIDOR_DO_PROJETO
                        </a>
                    </div>
                `;
            }
        } else {
            alert("Aguardando confirmação bancária...");
            el.confirmPixBtn.textContent = "> CONFIRMAR_PAGAMENTO";
        }
    } catch (e) { 
        alert("Erro na rede. Verifique sua conexão."); 
        el.confirmPixBtn.textContent = "> CONFIRMAR_PAGAMENTO";
    }
});

// ==================================================================================
// INICIALIZAÇÃO DA PÁGINA
// ==================================================================================
document.addEventListener('DOMContentLoaded', () => {
    inicializarLoginSteam();
    conectarFirebase();

    const usuarioSalvo = localStorage.getItem('steam_user');
    if (usuarioSalvo) {
        efetuarLoginInterface(usuarioSalvo);
    }
});