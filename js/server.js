import express from 'express';
import cors from 'cors';
import { MercadoPagoConfig, Payment } from 'mercadopago';

const app = express();
app.use(cors());
app.use(express.json());

// SUBSTITUA PELA SUA CHAVE REAL (começa com TEST-)
const client = new MercadoPagoConfig({ accessToken: 'APP_USR-3018200651275040-070221-412078a560b2bdab59b4dcad8dd7b337-3513867559' });

// server.js - Adicione este log para ver se o Mercado Pago está respondendo
app.post('/api/gerar-pix', async (req, res) => {
    try {
        const { valor } = req.body;
        console.log("Iniciando pagamento de:", valor);
        
        // Verifica se o cliente está definido
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

        console.log("Sucesso! Pagamento criado.");
        res.json({
            idTransacao: result.id,
            pixQrCodeBase64: result.point_of_interaction?.transaction_data?.qr_code_base64,
            pixCopiaECola: result.point_of_interaction?.transaction_data?.qr_code
        });

    } catch (error) {
        // ISSO VAI MOSTRAR O ERRO REAL NO SEU TERMINAL
        console.error("--- ERRO FATAL NO SERVIDOR ---");
        console.error("Mensagem:", error.message);
        if (error.response) {
            console.error("Detalhes do MP:", JSON.stringify(error.response.data, null, 2));
        }
        
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/verificar-pagamento/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const payment = new Payment(client);
        const result = await payment.get({ id });

        res.json({
            pago: result.status === 'approved'
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao verificar' });
    }
});

app.listen(3000, () => {
    console.log('Servidor de PIX rodando em http://localhost:3000');
});