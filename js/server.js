import express from 'express';
import cors from 'cors';
import { MercadoPagoConfig, Payment } from 'mercadopago';

const app = express();
app.use(cors());
app.use(express.json());

// --- CONFIGURAÇÃO DO MERCADO PAGO ---
const client = new MercadoPagoConfig({ accessToken: 'APP_USR-3018200651275040-070221-412078a560b2bdab59b4dcad8dd7b337-3513867559' });

// --- BANCO DE DADOS EM MEMÓRIA DO SERVIDOR ---
let bancoDeDados = {
    meta_global_arrecadada: 0.00
};

// Rota para o front-end buscar o progresso global acumulado
app.get('/api/meta-progresso', (req, res) => {
    res.json({ arrecadadoAtual: bancoDeDados.meta_global_arrecadada });
});

// Rota para gerar o QR Code do Pix via Mercado Pago
app.post('/api/gerar-pix', async (req, res) => {
    try {
        const { valor } = req.body;
        if (!client) throw new Error("Cliente do Mercado Pago não inicializado.");

        const payment = new Payment(client);
        const result = await payment.create({
            body: {
                transaction_amount: parseFloat(valor),
                description: 'Doação Pix',
                payment_method_id: 'pix',
                payer: { email: 'doador@exemplo.com' }
            }
        });

        res.json({
            idTransacao: result.id,
            pixQrCodeBase64: result.point_of_interaction?.transaction_data?.qr_code_base64,
            pixCopiaECola: result.point_of_interaction?.transaction_data?.qr_code
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota para verificar o status do pagamento Pix e salvar o valor das transferências
app.get('/api/verificar-pagamento/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const payment = new Payment(client);
        const result = await payment.get({ id });

        const pago = result.status === 'approved';
        
        if (pago && result.transaction_amount) {
            bancoDeDados.meta_global_arrecadada += parseFloat(result.transaction_amount);
        }

        res.json({
            pago: pago,
            arrecadadoAtual: bancoDeDados.meta_global_arrecadada
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao verificar' });
    }
});

// ROTA DA STEAM SOLUÇÃO DEFINITIVA: O seu próprio servidor busca o XML público. 
// Sem chave da API, sem CORS e sem depender do aplicativo do celular!
app.get('/api/steam-perfil/:steamId', async (req, res) => {
    try {
        const { steamId } = req.params;
        const urlPublicaSteam = `https://steamcommunity.com/profiles/${steamId}/?xml=1`;
        
        // O Node.js faz a requisição direta (a Steam aceita sem bloqueio de CORS aqui)
        const resposta = await fetch(urlPublicaSteam);
        const textoXml = await resposta.text();
        
        // Envia o XML direto e limpo para o main.js tratar
        res.set('Content-Type', 'text/xml');
        res.send(textoXml);
    } catch (error) {
        console.error("Erro interno ao buscar perfil:", error);
        res.status(500).json({ error: 'Erro ao conectar com a Steam' });
    }
});

app.listen(3000, () => {
    console.log('Servidor rodando com sucesso na porta 3000 (Sem dependência de Chave API)!');
});