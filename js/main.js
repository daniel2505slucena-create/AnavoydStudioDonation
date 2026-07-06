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
// --- ELEMENTOS DO DOM (MAPEAMENTO CORRIGIDO) ---
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
// --- PERSISTÊNCIA E CARREGAMENTO ---
// ==========================================
async function carregarDadosEProgresso() {
    let salvoUsuario = localStorage.getItem('usuario_total_doado');
    estado.totalDoadoPeloUsuario = salvoUsuario ? parseFloat(salvoUsuario) : 0.00;

    try {
        const resposta = await fetch(`${URL_API}/api/meta-progresso`);
        const dados = await resposta.json();
        estado.arrecadadoAtual = parseFloat(dados.arrecadadoAtual || 0);
    } catch (e) {
        console.error("Servidor em standby ou offline, carregando backup local:", e);
        let backupGlobal = localStorage.getItem('meta_global_arrecadada');
        estado.arrecadadoAtual = backupGlobal ? parseFloat(backupGlobal) : 0.00;
    }
    
    atualizarProgressoGeral();
    atualizarTierUsuario();
}

// ==========================================
// --- FUNÇÕES DE ATUALIZAÇÃO VISUAL ---
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
    if (el.steamBtn) {
        // Uso de addEventListener evita conflitos de sobrescrita
        el.steamBtn.addEventListener('click', (e) => {
            if (!estado.logadoSteam) {
                e.preventDefault();
                window.location.href = STEAM_OPENID_URL;
            }
        });
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('openid.identity')) {
        const identityUrl = urlParams.get('openid.identity');
        const steamIdReal = identityUrl.split('/').pop();
        efetuarLoginInterface(steamIdReal);
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

async function buscarDadosPerfilSteam(steamId) {
    try {
        const resposta = await fetch(`${URL_API}/api/steam-perfil/${steamId}`);
        const textoXml = await resposta.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(textoXml, "text/xml");
        const nome = xmlDoc.getElementsByTagName("steamID")[0]?.textContent;
        
        if (nome) return { personaname: nome, steamid: steamId };
    } catch (erro) { 
        console.error("Erro ao puxar dados do perfil Steam:", erro); 
    }
    return null;
}

async function efetuarliveLoginInterface(steamId) {
    // Redireciona para a função principal com nome correto
    efetuarLoginInterface(steamId);
}

async function efetuarLoginInterface(steamId) {
    estado.logadoSteam = true;
    estado.steamId = steamId;
    localStorage.setItem('steam_user', steamId);

    if (el.steamBtn) {
        el.steamBtn.textContent = "[ LOGOUT ]";
        // Altera o comportamento do clique para limpar a sessão
        el.steamBtn.addEventListener('click', (e) => {
            if (estado.logadoSteam) {
                e.preventDefault();
                localStorage.removeItem('steam_user');
                localStorage.removeItem('steam_user_dados');
                window.location.href = URL_DO_SEU_SITE;
            }
        });
    }
    
    if (el.steamWarning) el.steamWarning.classList.add('hidden');
    if (el.pixContainer) el.pixContainer.classList.remove('disabled');
    
    if (el.statusIndicator) {
        el.statusIndicator.classList.remove('offline');
        el.statusIndicator.classList.add('online');
    }
    
    let dadosPerfil = JSON.parse(localStorage.getItem('steam_user_dados'));
    if (!dadosPerfil || dadosPerfil.steamid !== steamId) {
        if (el.steamStatus) el.steamStatus.textContent = "CONECTANDO_TERMINAL...";
        dadosPerfil = await buscarDadosPerfilSteam(steamId);
        if (dadosPerfil) localStorage.setItem('steam_user_dados', JSON.stringify(dadosPerfil));
    }
    
    if (dadosPerfil && el.steamStatus) {
        el.steamStatus.textContent = `USER: ${dadosPerfil.personaname}`;
        el.steamStatus.classList.add('online-text');
    } else if (el.steamStatus) {
        el.steamStatus.textContent = "SYSTEM_ONLINE";
        el.steamStatus.classList.add('online-text');
    }
}

function verificarSessaoExistente() {
    const usuarioSalvo = localStorage.getItem('steam_user');
    if (usuarioSalvo && !window.location.search.includes('openid.identity')) {
        efetuarLoginInterface(usuarioSalvo);
    }
}

// ==========================================
// --- LÓGICA DO MODAL PIX ---
// ==========================================
async function abrirModalPix(valor) {
    if (!estado.logadoSteam) return; 

    estado.valorSelecionadoPix = parseFloat(valor);
    if (el.pixModal) el.pixModal.classList.remove('hidden');
    if (el.qrcodeContainer) el.qrcodeContainer.innerHTML = "<span style='color:var(--neon-green)'>GERANDO_UPLINK_PIX...</span>";
    if (el.pixKeyDisplay) el.pixKeyDisplay.value = "AGUARDE_DADOS...";

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
            
            new QRCode(el.qrcodeContainer, {
                text: data.pixCopiaECola,
                width: 180,
                height: 180,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
            
            if (el.pixKeyDisplay) el.pixKeyDisplay.value = data.pixCopiaECola;
        } else {
            alert("ERRO: Falha na resposta do Mercado Pago.");
            fecharModalPix();
        }
    } catch (error) {
        console.error("Erro ao gerar PIX:", error);
        alert("ERRO_DE_REDE: Servidor demorou para responder.");
        fecharModalPix();
    }
}

function fecharModalPix() {
    if (estado.verificandoPix) {
        if (!confirm("A validação está em andamento. Deseja abortar a operação?")) return;
    }
    if (el.pixModal) el.pixModal.classList.add('hidden');
    estado.verificandoPix = false;
    estado.idTransacaoAtual = null;
    if (el.qrcodeContainer) el.qrcodeContainer.innerHTML = "";
    if (el.pixKeyDisplay) el.pixKeyDisplay.value = "";
    if (el.confirmPixBtn) el.confirmPixBtn.textContent = "> CONFIRMAR_PAGAMENTO";
}

// ==========================================
// --- INTERAÇÕES E EVENTOS ---
// ==========================================
el.pixButtons.forEach(btn => btn.addEventListener('click', (e) => {
    if (e.target.id === 'pixCustomBtn') return;
    abrirModalPix(e.target.getAttribute('data-amount'));
}));

if (el.pixCustomBtn) {
    el.pixCustomBtn.addEventListener('click', () => {
        if (!estado.logadoSteam) return;
        const inputUsuario = prompt("Digite o valor da contribuição (Ex: 25,00):", "25,00");
        if (!inputUsuario) return;
        
        const valorLimpo = parseFloat(inputUsuario.replace(',', '.'));
        if (!isNaN(valorLimpo) && valorLimpo >= 0.01) {
            abrirModalPix(valorLimpo);
        } else {
            alert("SISTEMA: Valor incorreto inserido.");
        }
    });
}

if (el.closePixBtn) el.closePixBtn.addEventListener('click', fecharModalPix);

if (el.pixKeyDisplay) {
    el.pixKeyDisplay.addEventListener('click', () => {
        if (el.pixKeyDisplay.value && el.pixKeyDisplay.value !== "AGUARDE_DADOS...") {
            navigator.clipboard.writeText(el.pixKeyDisplay.value);
            alert("CÓDIGO COPIA E COLA COPIADO!");
        }
    });
}

if (el.confirmPixBtn) {
    el.confirmPixBtn.addEventListener('click', async () => {
        if (!estado.idTransacaoAtual) return;
        
        estado.verificandoPix = true;
        el.confirmPixBtn.textContent = "> REQUISITANDO_GATEWAY...";
        
        try {
            const resposta = await fetch(`${URL_API}/api/verificar-pagamento/${estado.idTransacaoAtual}`);
            const resultado = await resposta.json();
            
            if (resultado.pago === true) {
                estado.arrecadadoAtual = resultado.arrecadadoAtual;
                estado.totalDoadoPeloUsuario += estado.valorSelecionadoPix;
                
                localStorage.setItem('meta_global_arrecadada', estado.arrecadadoAtual.toString());
                localStorage.setItem('usuario_total_doado', estado.totalDoadoPeloUsuario.toString());
                
                atualizarProgressoGeral();
                atualizarTierUsuario();
                fecharModalPix();
                alert("AUTENTICADO: Transação aceita e registrada.");
            } else {
                alert("AVISO: Pagamento pendente ou não processado pelo banco. Tente novamente em instantes.");
                el.confirmPixBtn.textContent = "> CONFIRMAR_PAGAMENTO";
            }
        } catch (e) { 
            alert("ERRO: Resposta inválida da rede de validação."); 
            el.confirmPixBtn.textContent = "> CONFIRMAR_PAGAMENTO";
        }
        estado.verificandoPix = false;
    });
}

// ==========================================
// --- INICIALIZAÇÃO ASSÍNCRONA CORRIGIDA ---
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Ativa a interface e eventos IMEDIATAMENTE (Corrige o botão morto)
    inicializarLoginSteam();
    verificarSessaoExistente();
    
    // 2. Carrega as informações da API em background (Sem bloquear os botões)
    carregarDadosEProgresso();
});