import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const URL_API = window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://anavoydstudiodonatebackend.onrender.com';

let estado = {
    logadoSteam: false,
    steamId: null,
    arrecadadoAtual: 0.00,
    totalDoadoPeloUsuario: 0.00,
    idTransacaoAtual: null
};

// Seletores do DOM
const el = {
    pixButtons: document.querySelectorAll('.btn-pix'),
    pixCustomBtn: document.getElementById('pixCustomBtn'),
    pixModal: document.getElementById('pixModal'),
    closePixBtn: document.getElementById('closePixBtn'),
    qrcodeContainer: document.getElementById('qrcode'),
    pixKeyDisplay: document.getElementById('pixKeyDisplay'),
    confirmPixBtn: document.getElementById('confirmPixBtn'),
    currentAmount: document.getElementById('currentAmount'),
    currentTier: document.getElementById('currentTier')
};

// Funções de formatação
function formatarMoeda(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

function atualizarUI() {
    if(el.currentAmount) el.currentAmount.textContent = formatarMoeda(estado.arrecadadoAtual);
    
    let tier = "NENHUM", cor = "#ff4d4d";
    if (estado.totalDoadoPeloUsuario >= 500) { tier = "DIAMANTE"; cor = "#00f2ff"; }
    else if (estado.totalDoadoPeloUsuario >= 100) { tier = "PLATINA"; cor = "#a000ff"; }
    else if (estado.totalDoadoPeloUsuario >= 50) { tier = "OURO"; cor = "#ffd700"; }
    else if (estado.totalDoadoPeloUsuario >= 20) { tier = "BRONZE"; cor = "#cd7f32"; }
    
    if(el.currentTier) el.currentTier.innerHTML = `SEU TIER: <span style="color:${cor};">${tier}</span>`;
}

// Lógica Pix
async function abrirModalPix(valor) {
    if (!estado.logadoSteam) return alert("Faça login na Steam.");
    el.pixModal?.classList.remove('hidden');
    el.qrcodeContainer.innerHTML = "GERANDO...";

    try {
        const resp = await fetch(`${URL_API}/api/gerar-pix`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ valor: valor })
        });
        const data = await resp.json();
        
        if (data.pixCopiaECola) {
            estado.idTransacaoAtual = data.idTransacao;
            // A MÁGICA ESTÁ AQUI: TRIM REMOVE ESPAÇOS QUE QUEBRAM O LEITOR
            const codigoLimpo = data.pixCopiaECola.trim(); 
            
            el.qrcodeContainer.innerHTML = "";
            new QRCode(el.qrcodeContainer, { text: codigoLimpo, width: 200, height: 200 });
            el.pixKeyDisplay.value = codigoLimpo;
        }
    } catch (e) { alert("Erro servidor"); }
}

// Listeners
el.pixButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const valor = e.currentTarget.getAttribute('data-amount');
        if (valor) abrirModalPix(valor);
    });
});

el.pixCustomBtn?.addEventListener('click', () => {
    const v = prompt("Digite o valor:");
    if (v) abrirModalPix(parseFloat(v.replace(',', '.')));
});

el.confirmPixBtn?.addEventListener('click', async () => {
    if (!estado.idTransacaoAtual) return;
    try {
        const resp = await fetch(`${URL_API}/api/verificar-pagamento`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: estado.idTransacaoAtual, steamId: estado.steamId })
        });
        const res = await resp.json();
        if (res.pago) { alert("Sucesso!"); el.pixModal.classList.add('hidden'); }
        else alert("Aguardando...");
    } catch (e) { alert("Erro rede"); }
});

el.closePixBtn?.addEventListener('click', () => el.pixModal?.classList.add('hidden'));

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    // 1. Escuta alterações no Firebase (Isso faz o número atualizar na tela em tempo real)
    if (window.db) {
        onSnapshot(doc(window.db, "stats", "global"), (snap) => {
            if (snap.exists()) {
                estado.arrecadadoAtual = snap.data().arrecadado;
                atualizarUI();
            }
        });
    }

    const user = localStorage.getItem('steam_user');
    if (user) {
        estado.logadoSteam = true;
        estado.steamId = user;
        onSnapshot(doc(window.db, "users", user), (s) => {
            if (s.exists()) { 
                estado.totalDoadoPeloUsuario = s.data().totalDoado; 
                atualizarUI(); 
            }
        });
    }
});