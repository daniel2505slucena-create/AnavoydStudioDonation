// ==========================================
// --- CONFIGURAÇÃO DINÂMICA DA API ---
// ==========================================
// Se o site rodar localmente, usa a porta 3000. 
// Quando estiver no seu domínio do GitHub Pages, substitua o link do Render pelo link que o Render te der.
const URL_API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://SUA-URL-AQUI.onrender.com'; // <-- Substitua pelo link gerado no Render quando subir o back-end

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
// --- PERSISTÊNCIA REAL DE DADOS ---
// ==========================================
async function carregarDadosEProgresso() {
    // Carrega o total que este usuário específico doou
    let salvoUsuario = localStorage.getItem('usuario_total_doado');
    estado.totalDoadoPeloUsuario = salvoUsuario ? parseFloat(salvoUsuario) : 0.00;

    try {
        // Busca do servidor o progresso real acumulado globalmente de todas as transferências
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
    steamAvatar: document.getElementById('steamAvatar'),
    steamWarning: document.getElementById('steamWarning'),
    pixButtons: document.querySelectorAll('.pix-btn'),
    pixCustomBtn: document.getElementById('pixCustomBtn'),
    pixModal: document.getElementById('pixModal'),
    closePixBtn: document.getElementById('closePixBtn'),
    pixAmountInput: document.getElementById('pixAmount'),
    qrcodeContainer: document.getElementById('qrcode'),
    copyPixBtn: document.getElementById('copyPixBtn'),
    pixKeyDisplay: document.getElementById('pixKeyDisplay'),
    confirmPixBtn: document.getElementById('confirmPixBtn'),
    currentAmount: document.getElementById('currentAmount'),
    percentage: document.getElementById('percentage'),
    progressBar: document.getElementById('progress'),
    currentTier: document.getElementById('currentTier'),
    tierCards: document.querySelectorAll('.benefit-tier')
};

const formatarMoeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
    let tierAtualNome = "Nenhum (Contribua para desbloquear)";
    let corTier = "var(--primary)";
    el.tierCards.forEach(card => card.classList.remove('active-tier'));
    
    const tiersOrdenados = Array.from(el.tierCards).sort((a, b) => b.dataset.min - a.dataset.min);
    for (const card of tiersOrdenados) {
        const minNecessario = parseFloat(card.dataset.min);
        if (estado.totalDoadoPeloUsuario >= minNecessario) {
            card.classList.add('active-tier');
            const badge = card.querySelector('.tier-badge');
            tierAtualNome = badge.textContent;
            corTier = window.getComputedStyle(badge).color || "#fff";
            break;
        }
    }
    if(el.currentTier) el.currentTier.innerHTML = `Seu tier atual: <span style="color:${corTier}; font-weight:600;">${tierAtualNome}</span> (Total doado: ${formatarMoeda(estado.totalDoadoPeloUsuario)})`;
}

// ==========================================
// --- AUTENTICAÇÃO STEAM ---
// ==========================================
function inicializarLoginSteam() {
    if (el.steamBtn) el.steamBtn.href = STEAM_OPENID_URL;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('openid.identity')) {
        const identityUrl = urlParams.get('openid.identity');
        const steamIdReal = identityUrl.split('/').pop();
        efetuarLoginInterface(steamIdReal);
    }
}

async function buscarDadosPerfilSteam(steamId) {
    try {
        // Envia o pedido para o seu back-end buscar o XML público sem CORS e sem Chave API
        const urlAlvo = `${URL_API}/api/steam-perfil/${steamId}`;
        const resposta = await fetch(urlAlvo);
        const textoXml = await resposta.text();
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(textoXml, "text/xml");
        const nome = xmlDoc.getElementsByTagName("steamID")[0]?.textContent;
        const foto = xmlDoc.getElementsByTagName("avatarIcon")[0]?.textContent;
        
        if (nome && foto) {
            return { personaname: nome, avatar: foto, steamid: steamId };
        }
    } catch (erro) { 
        console.error("Erro ao buscar dados do perfil da Steam pelo servidor:", erro); 
    }
    return null;
}

async function efectuarLoginInterface(steamId) {
    estado.logadoSteam = true;
    estado.steamId = steamId;
    if (el.steamBtn) {
        el.steamBtn.textContent = "Logout";
        el.steamBtn.href = URL_DO_SEU_SITE;
        el.steamBtn.addEventListener('click', () => {
            localStorage.removeItem('steam_user');
            localStorage.removeItem('steam_user_dados');
        });
    }
    el.pixButtons.forEach(btn => btn.removeAttribute('disabled'));
    if (el.steamWarning) el.steamWarning.style.display = "none";
    
    let dadosPerfil = JSON.parse(localStorage.getItem('steam_user_dados'));
    if (!dadosPerfil || dadosPerfil.steamid !== steamId) {
        dadosPerfil = await buscarDadosPerfilSteam(steamId);
        if (dadosPerfil) localStorage.setItem('steam_user_dados', JSON.stringify(dadosPerfil));
    }
    if (dadosPerfil && el.steamStatus && el.steamAvatar) {
        el.steamStatus.textContent = dadosPerfil.personaname;
        el.steamAvatar.src = dadosPerfil.avatar;
        el.steamAvatar.style.display = "block";
    }
    localStorage.setItem('steam_user', steamId);
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
    estado.valorSelecionadoPix = parseFloat(valor);
    const inputPix = document.getElementById('pixAmount');
    if (inputPix) inputPix.value = `R$ ${parseFloat(valor).toFixed(2).replace('.', ',')}`;

    if (el.pixModal) el.pixModal.style.display = "flex";
    if (el.qrcodeContainer) el.qrcodeContainer.innerHTML = "Gerando QR Code...";

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
            
            new QRCode(document.getElementById("qrcode"), {
                text: data.pixCopiaECola,
                width: 180,
                height: 180
            });
            
            if (el.pixKeyDisplay) el.pixKeyDisplay.innerText = "Chave gerada com sucesso!";
            
            if (el.copyPixBtn) {
                el.copyPixBtn.onclick = () => {
                    navigator.clipboard.writeText(data.pixCopiaECola);
                    alert("Copia e Cola copiado!");
                };
            }
        } else {
            alert("Erro ao gerar Pix.");
        }
    } catch (error) {
        console.error("Erro na comunicação com a API do Pix:", error);
    }
}

function fecharModalPix() {
    if (estado.verificandoPix) {
        if (!confirm("Aguarde a validação! Deseja cancelar mesmo assim?")) return;
    }
    if (el.pixModal) el.pixModal.style.display = "none";
    estado.verificandoPix = false;
    estado.idTransacaoAtual = null;
    if (el.qrcodeContainer) el.qrcodeContainer.innerHTML = "";
}

// ==========================================
// --- EVENT LISTENERS E CONFIRMAÇÃO ---
// ==========================================
el.pixButtons.forEach(btn => btn.addEventListener('click', (e) => {
    if (e.target.id === 'pixCustomBtn') return;
    abrirModalPix(e.target.getAttribute('data-amount'));
}));

if (el.pixCustomBtn) {
    el.pixCustomBtn.addEventListener('click', () => {
        const inputUsuario = prompt("Digite o valor da doação (Ex: 1,00):", "1,00");
        if (!inputUsuario) return;
        
        const valorLimpo = parseFloat(inputUsuario.replace(',', '.'));
        if (!isNaN(valorLimpo) && valorLimpo >= 0.01) {
            abrirModalPix(valorLimpo);
        } else {
            alert("Valor inválido. Digite apenas números.");
        }
    });
}

if (el.closePixBtn) el.closePixBtn.addEventListener('click', fecharModalPix);

if (el.confirmPixBtn) {
    el.confirmPixBtn.addEventListener('click', async () => {
        if (!estado.idTransacaoAtual) return;
        estado.verificandoPix = true;
        el.confirmPixBtn.textContent = "Validando...";
        try {
            const resposta = await fetch(`${URL_API}/api/verificar-pagamento/${estado.idTransacaoAtual}`);
            const resultado = await resposta.json();
            
            if (resultado.pago === true) {
                // Sincroniza o valor de arrecadação global que o servidor atualizou e guardou
                estado.arrecadadoAtual = resultado.arrecadadoAtual;
                estado.totalDoadoPeloUsuario += estado.valorSelecionadoPix;
                
                // Salva os backups locais para consistência rápida do usuário
                localStorage.setItem('meta_global_arrecadada', estado.arrecadadoAtual.toString());
                localStorage.setItem('usuario_total_doado', estado.totalDoadoPeloUsuario.toString());
                
                atualizarProgressoGeral();
                atualizarTierUsuario();
                fecharModalPix();
                alert("✅ Pagamento confirmado e salvo com sucesso!");
            } else {
                alert("❌ Pagamento ainda não identificado no Mercado Pago.");
            }
        } catch (e) { 
            alert("Erro ao conectar no servidor."); 
        }
        estado.verificandoPix = false;
        el.confirmPixBtn.textContent = "Já paguei";
    });
}

// Inicialização limpa e assíncrona ao abrir a página
document.addEventListener('DOMContentLoaded', async () => {
    await carregarDadosEProgresso();
    inicializarLoginSteam();
    verificarSessaoExistente();
});