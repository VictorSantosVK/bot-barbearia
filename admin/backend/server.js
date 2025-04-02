require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const sequelize = require('../../config/database');
const Agendamento = require('../../models/Agendamento');

const app = express();
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'], 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'usuario', 'senha'] 
}));
console.log('Hash da senha:', bcrypt.hashSync('senha123', 8));
// Sincronizar o modelo com o banco de dados
sequelize.sync({ force: false })
  .then(() => console.log('Banco de dados sincronizado.'))
  .catch((err) => console.error('Erro ao sincronizar o banco de dados:', err));

// Dados do admin (simulado)
const admin = {
  usuario: 'admin',
  senha: bcrypt.hashSync('senha123', 8),
};

// Rota de login
app.post('/login', [
  body('usuario').notEmpty().withMessage('Usuário é obrigatório'),
  body('senha').notEmpty().withMessage('Senha é obrigatória'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { usuario, senha } = req.body;

  if (usuario === admin.usuario && bcrypt.compareSync(senha, admin.senha)) {
    res.json({ message: 'Login bem-sucedido' });
  } else {
    res.status(401).json({ error: 'Credenciais inválidas.' });
  }
});

// Middleware para verificar credenciais
function verificarCredenciais(req, res, next) {
  const usuario = req.headers['usuario'];
  const senha = req.headers['senha'];

  if (!usuario || !senha) {
    return res.status(401).json({ error: 'Credenciais não fornecidas.' });
  }

  if (usuario === admin.usuario && bcrypt.compareSync(senha, admin.senha)) {
    next();
  } else {
    res.status(401).json({ error: 'Credenciais inválidas.' });
  }
}

// Horários disponíveis por dia da semana
const horariosPorDia = {
  "segunda": ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"],
  "terca": ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"],
  "quarta": ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"],
  "quinta": ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"],
  "sexta": ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"],
  "sabado": ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"],
  "domingo": []
};

// Função para obter o dia da semana em português
function getDiaSemana(dateString) {
  const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  const date = new Date(dateString);
  return dias[date.getDay()];
}

// Rota para obter horários disponíveis
app.get('/horarios-disponiveis', verificarCredenciais, async (req, res) => {
  try {
    const { data } = req.query;
    
    // Validação rigorosa da data
    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return res.status(400).json({ error: 'Formato de data inválido. Use YYYY-MM-DD' });
    }

    // Verifica se a data é válida
    const dateObj = new Date(data);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ error: 'Data inválida' });
    }

    const diaSemana = getDiaSemana(data);
    const horariosDisponiveis = horariosPorDia[diaSemana] || [];

    const agendamentos = await Agendamento.findAll({
      where: { data },
      attributes: ['horario']
    });

    const horariosAgendados = agendamentos.map(a => a.horario);
    const horariosLivres = horariosDisponiveis.filter(
      horario => !horariosAgendados.includes(horario)
    );

    res.json({
      diaSemana,
      horariosDisponiveis,
      horariosLivres
    });
  } catch (error) {
    console.error('Erro ao buscar horários:', error);
    res.status(500).json({ error: 'Erro ao buscar horários disponíveis' });
  }
});

// Rota para criar um agendamento
app.post('/agendamentos', verificarCredenciais, [
  body('data')
    .notEmpty().withMessage('Data é obrigatória')
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Formato de data inválido. Use YYYY-MM-DD')
    .custom(value => {
      const date = new Date(value);
      return !isNaN(date.getTime());
    }).withMessage('Data inválida'),
  // ... outras validações
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Erro de validação',
      details: errors.array() 
    });
  }

  try {
    const { nome_cliente, telefone, data, horario, servico } = req.body;
    
    // Verifica conflito de horário
    const conflito = await Agendamento.findOne({
      where: { data, horario }
    });
    
    if (conflito) {
      return res.status(409).json({ error: 'Este horário já está agendado' });
    }

    const agendamento = await Agendamento.create({
      nome_cliente,
      telefone,
      data,
      horario,
      servico
    });

    res.status(201).json(agendamento);
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    res.status(500).json({ error: 'Erro ao processar o agendamento' });
  }
});

// Rota para listar todos os agendamentos
app.get('/agendamentos', verificarCredenciais, async (req, res) => {
  try {
    const agendamentos = await Agendamento.findAll({
      order: [
        ['data', 'ASC'],
        ['horario', 'ASC'],
      ],
    });

    res.json(agendamentos);
  } catch (error) {
    console.error('Erro ao listar agendamentos:', error);
    res.status(500).json({ error: 'Erro ao listar agendamentos' });
  }
});

// Rota para editar um agendamento
app.put('/agendamentos/:id', verificarCredenciais, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome_cliente, telefone, data, horario, servico } = req.body;

    const agendamento = await Agendamento.findByPk(id);
    if (!agendamento) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    await agendamento.update({
      nome_cliente,
      telefone,
      data,
      horario,
      servico
    });

    res.json(agendamento);

  } catch (error) {
    console.error('Erro ao atualizar agendamento:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para deletar um agendamento
app.delete('/agendamentos/:id', verificarCredenciais, async (req, res) => {
  try {
    const { id } = req.params;

    const agendamento = await Agendamento.findByPk(id);
    if (!agendamento) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    await agendamento.destroy();
    res.status(204).send();
  } catch (error) {
    console.error('Erro ao deletar agendamento:', error);
    res.status(500).json({ error: error.message });
  }
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno no servidor.' });
});

// Iniciar o servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});