const express = require('express');
const cors = require('cors');
const snmp = require('snmp-native');

const app = express();
const PORT = 3000;

// Habilita o CORS para que o seu navegador consiga falar com este servidor
app.use(cors());

app.get('/status', (req, res) => {
    const ip = req.query.ip;

    if (!ip) {
        return res.status(400).json({ success: false, error: "IP não fornecido" });
    }

    // Criamos uma sessão SNMP com a impressora
    // Timeout de 2.5s para não travar o site se a impressora estiver desligada
    const session = new snmp.Session({ host: ip, community: 'public', timeout: 2500 });

    // OIDs padrão da MIB de impressoras (RFC 1213 / RFC 1514)
    // Índice 1=K, 2=C, 3=M, 4=Y (Isso pode variar em alguns modelos raros)
    const oids = [
        [1, 3, 6, 1, 2, 1, 43, 11, 1, 1, 9, 1, 1], // Preto (K)
        [1, 3, 6, 1, 2, 1, 43, 11, 1, 1, 9, 1, 2], // Ciano (C)
        [1, 3, 6, 1, 2, 1, 43, 11, 1, 1, 9, 1, 3], // Magenta (M)
        [1, 3, 6, 1, 2, 1, 43, 11, 1, 1, 9, 1, 4]  // Amarelo (Y)
    ];

    session.getAll({ oids: oids }, (err, varbinds) => {
        if (err || !varbinds || varbinds.length === 0) {
            console.error(`[ERRO] Falha ao consultar IP: ${ip}`);
            res.json({ success: false, error: "Impressora Offline ou SNMP desativado" });
        } else {
            // Função para tratar o valor retornado
            // Algumas impressoras retornam -2 para 'Toner OK mas nível desconhecido'
            // ou 0 para vazio. Ajustamos para nunca retornar negativo ao frontend.
            const formatarNivel = (vb) => {
                if (!vb || vb.value < 0) return 0;
                if (vb.value > 100) return 100;
                return vb.value;
            };

            res.json({
                success: true,
                niveis: {
                    k: formatarNivel(varbinds[0]),
                    c: formatarNivel(varbinds[1]),
                    m: formatarNivel(varbinds[2]),
                    y: formatarNivel(varbinds[3])
                }
            });
        }
        
        // Sempre fechar a sessão para não vazar memória
        session.close();
    });
});

app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` SERVIDOR DE MONITORAMENTO CMYK ATIVO    `);
    console.log(` Porta: ${PORT}                            `);
    console.log(` Endpoint: http://localhost:${PORT}/status `);
    console.log(`=========================================`);
});