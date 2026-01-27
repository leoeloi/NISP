const { Client } = require('pg');

exports.handler = async (event, context) => {
    // 1. Configurar conexão com o banco (Pega a senha das variáveis de ambiente)
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Necessário para o Neon
    });

    try {
        await client.connect();

        // 2. ROTA: GET (Ler dados)
        if (event.httpMethod === 'GET') {
            const res = await client.query("SELECT data FROM nisp_store WHERE key_name = 'main_db'");
            await client.end();
            
            return {
                statusCode: 200,
                body: JSON.stringify(res.rows[0]?.data || {})
            };
        }

        // 3. ROTA: POST (Salvar dados)
        if (event.httpMethod === 'POST') {
            const newData = event.body; // O JSON que vem do Frontend
            
            // Atualiza o registro no banco
            await client.query(
                "UPDATE nisp_store SET data = $1, updated_at = NOW() WHERE key_name = 'main_db'",
                [newData]
            );
            await client.end();

            return {
                statusCode: 200,
                body: JSON.stringify({ message: "Salvo com sucesso no Neon!" })
            };
        }

        return { statusCode: 405, body: "Method Not Allowed" };

    } catch (error) {
        console.error('Erro no banco:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Erro interno no servidor: " + error.message })
        };
    }
};