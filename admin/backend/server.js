require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const { Op } = require("sequelize");

const sequelize = require("../../config/database");
const Agendamento = require("../../models/Agendamento");

const app = express();

const PORT = process.env.PORT || 3001;

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "xxx";
const JWT_SECRET =
  process.env.JWT_SECRET || "segredo_super_simples_para_teste_local";

const admin = {
  usuario: ADMIN_USER,
  senhaHash: bcrypt.hashSync(ADMIN_PASSWORD, 8),
};

app.use(express.json());

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.static(path.join(__dirname, "public")));

sequelize
  .sync({ force: false })
  .then(() => console.log("Banco de dados sincronizado."))
  .catch((err) => console.error("Erro ao sincronizar o banco de dados:", err));

const horariosPorDia = {
  segunda: [
    "08:00",
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
    "18:30",
  ],
  terca: [
    "08:00",
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
    "18:30",
  ],
  quarta: [
    "08:00",
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
    "18:30",
  ],
  quinta: [
    "08:00",
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
    "18:30",
  ],
  sexta: [
    "08:00",
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
    "18:30",
  ],
  sabado: [
    "08:00",
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
    "18:30",
  ],
  domingo: [],
};

// Preço de cada serviço oferecido pelo painel admin. Usado para preencher
// preco_servico automaticamente ao criar/editar um agendamento, para que o
// faturamento por dia/semana/mês seja calculado corretamente.
const precosServicos = {
  Cabelo: 30.0,
  Barba: 30.0,
  "Cabelo e Barba": 45.0,
  Sobrancelha: 10.0,
  "Cabelo e Sobrancelha": 35.0,
  "Cabelo, Barba e Sobrancelha": 50.0,
};
function calcularPrecoServico(servico) {
  return precosServicos[servico] ?? 0;
}

function getDiaSemana(dateString) {
  const dias = [
    "domingo",
    "segunda",
    "terca",
    "quarta",
    "quinta",
    "sexta",
    "sabado",
  ];

  const [ano, mes, dia] = dateString.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);

  return dias[data.getDay()];
}

function formatarHorarioParaBanco(horario) {
  if (!horario) return horario;

  if (/^\d{2}:\d{2}$/.test(horario)) {
    return `${horario}:00`;
  }

  return horario;
}

function validarDataYYYYMMDD(data) {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return false;
  }

  const [ano, mes, dia] = data.split("-").map(Number);
  const dateObj = new Date(ano, mes - 1, dia);

  return (
    dateObj.getFullYear() === ano &&
    dateObj.getMonth() === mes - 1 &&
    dateObj.getDate() === dia
  );
}

function intervaloDoDia(data) {
  const [ano, mes, dia] = data.split("-").map(Number);

  const inicio = new Date(ano, mes - 1, dia, 0, 0, 0, 0);
  const fim = new Date(ano, mes - 1, dia, 23, 59, 59, 999);

  return { inicio, fim };
}

// Semana corrente: domingo 00:00 até sábado 23:59:59.
function intervaloDaSemana() {
  const hoje = new Date();
  const diaSemana = hoje.getDay();

  const inicio = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    hoje.getDate() - diaSemana,
    0,
    0,
    0,
    0,
  );

  const fim = new Date(inicio);
  fim.setDate(inicio.getDate() + 6);
  fim.setHours(23, 59, 59, 999);

  return { inicio, fim };
}

// Mês corrente: dia 1 00:00 até o último dia do mês 23:59:59.
function intervaloDoMes() {
  const hoje = new Date();

  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1, 0, 0, 0, 0);
  const fim = new Date(
    hoje.getFullYear(),
    hoje.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );

  return { inicio, fim };
}

function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: "Token não fornecido.",
    });
  }

  const partes = authHeader.split(" ");

  if (partes.length !== 2 || partes[0] !== "Bearer") {
    return res.status(401).json({
      error: "Formato do token inválido.",
    });
  }

  const token = partes[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      error: "Token inválido ou expirado.",
    });
  }
}

app.get("/", (req, res) => {
  res.redirect("/admin.html");
});

app.post(
  "/login",
  [
    body("usuario").notEmpty().withMessage("Usuário é obrigatório"),
    body("senha").notEmpty().withMessage("Senha é obrigatória"),
  ],
  (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Erro de validação",
        details: errors.array(),
      });
    }

    const { usuario, senha } = req.body;

    const usuarioValido = usuario === admin.usuario;
    const senhaValida = bcrypt.compareSync(senha, admin.senhaHash);

    if (!usuarioValido || !senhaValida) {
      return res.status(401).json({
        error: "Credenciais inválidas.",
      });
    }

    const token = jwt.sign(
      {
        usuario: admin.usuario,
        role: "admin",
      },
      JWT_SECRET,
      {
        expiresIn: "8h",
      },
    );

    return res.json({
      message: "Login bem-sucedido.",
      token,
      usuario: admin.usuario,
    });
  },
);

app.get("/me", verificarToken, (req, res) => {
  res.json({
    usuario: req.admin.usuario,
    role: req.admin.role,
  });
});

app.get("/dashboard", verificarToken, async (req, res) => {
  try {
    const hoje = new Date();

    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const dia = String(hoje.getDate()).padStart(2, "0");

    const dataHoje = `${ano}-${mes}-${dia}`;
    const { inicio: inicioHoje, fim: fimHoje } = intervaloDoDia(dataHoje);
    const { inicio: inicioSemana, fim: fimSemana } = intervaloDaSemana();
    const { inicio: inicioMes, fim: fimMes } = intervaloDoMes();

    const totalAgendamentos = await Agendamento.count();

    const agendamentosHoje = await Agendamento.count({
      where: {
        data: {
          [Op.between]: [inicioHoje, fimHoje],
        },
      },
    });

    const futuros = await Agendamento.count({
      where: {
        data: {
          [Op.gte]: inicioHoje,
        },
      },
    });

    const cabelo = await Agendamento.count({
      where: {
        servico: "Cabelo",
      },
    });

    const cabeloBarba = await Agendamento.count({
      where: {
        servico: "Cabelo e Barba",
      },
    });

    // Faturamento considera apenas agendamentos já marcados como concluídos.
    const faturamentoHoje = await Agendamento.sum("preco_servico", {
      where: {
        concluido: true,
        data: { [Op.between]: [inicioHoje, fimHoje] },
      },
    });

    const faturamentoSemana = await Agendamento.sum("preco_servico", {
      where: {
        concluido: true,
        data: { [Op.between]: [inicioSemana, fimSemana] },
      },
    });

    const faturamentoMes = await Agendamento.sum("preco_servico", {
      where: {
        concluido: true,
        data: { [Op.between]: [inicioMes, fimMes] },
      },
    });

    res.json({
      totalAgendamentos,
      agendamentosHoje,
      futuros,
      servicos: {
        cabelo,
        cabeloBarba,
      },
      faturamento: {
        hoje: faturamentoHoje || 0,
        semana: faturamentoSemana || 0,
        mes: faturamentoMes || 0,
      },
    });
  } catch (error) {
    console.error("Erro ao carregar dashboard:", error);
    res.status(500).json({
      error: "Erro ao carregar dashboard.",
    });
  }
});

app.get("/horarios-disponiveis", verificarToken, async (req, res) => {
  try {
    const { data } = req.query;

    if (!validarDataYYYYMMDD(data)) {
      return res.status(400).json({
        error: "Formato de data inválido. Use YYYY-MM-DD.",
      });
    }

    const diaSemana = getDiaSemana(data);
    const horariosDisponiveis = horariosPorDia[diaSemana] || [];

    const { inicio, fim } = intervaloDoDia(data);

    const agendamentos = await Agendamento.findAll({
      where: {
        data: {
          [Op.between]: [inicio, fim],
        },
      },
      attributes: ["horario"],
    });

    const horariosAgendados = agendamentos.map((a) =>
      a.horario ? a.horario.slice(0, 5) : null,
    );

    const horariosLivres = horariosDisponiveis.filter(
      (horario) => !horariosAgendados.includes(horario),
    );

    res.json({
      data,
      diaSemana,
      horariosDisponiveis,
      horariosAgendados,
      horariosLivres,
    });
  } catch (error) {
    console.error("Erro ao buscar horários:", error);
    res.status(500).json({
      error: "Erro ao buscar horários disponíveis.",
    });
  }
});

app.get("/agendamentos", verificarToken, async (req, res) => {
  try {
    const { data, cliente, servico } = req.query;

    const where = {};

    if (data) {
      if (!validarDataYYYYMMDD(data)) {
        return res.status(400).json({
          error: "Formato de data inválido. Use YYYY-MM-DD.",
        });
      }

      const { inicio, fim } = intervaloDoDia(data);

      where.data = {
        [Op.between]: [inicio, fim],
      };
    }

    if (cliente) {
      where.nome_cliente = {
        [Op.like]: `%${cliente}%`,
      };
    }

    if (servico) {
      where.servico = servico;
    }

    const agendamentos = await Agendamento.findAll({
      where,
      order: [
        ["data", "ASC"],
        ["horario", "ASC"],
      ],
    });

    res.json(agendamentos);
  } catch (error) {
    console.error("Erro ao listar agendamentos:", error);
    res.status(500).json({
      error: "Erro ao listar agendamentos.",
    });
  }
});

app.get("/agendamentos/:id", verificarToken, async (req, res) => {
  try {
    const { id } = req.params;

    const agendamento = await Agendamento.findByPk(id);

    if (!agendamento) {
      return res.status(404).json({
        error: "Agendamento não encontrado.",
      });
    }

    res.json(agendamento);
  } catch (error) {
    console.error("Erro ao buscar agendamento:", error);
    res.status(500).json({
      error: "Erro ao buscar agendamento.",
    });
  }
});

app.post(
  "/agendamentos",
  verificarToken,
  [
    body("nome_cliente")
      .notEmpty()
      .withMessage("Nome do cliente é obrigatório"),
    body("telefone").notEmpty().withMessage("Telefone é obrigatório"),
    body("data")
      .notEmpty()
      .withMessage("Data é obrigatória")
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage("Formato de data inválido. Use YYYY-MM-DD."),
    body("horario")
      .notEmpty()
      .withMessage("Horário é obrigatório")
      .matches(/^\d{2}:\d{2}(:\d{2})?$/)
      .withMessage("Formato de horário inválido. Use HH:MM."),
    body("servico").notEmpty().withMessage("Serviço é obrigatório"),
  ],
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Erro de validação",
        details: errors.array(),
      });
    }

    try {
      const { nome_cliente, telefone, data, horario, servico } = req.body;

      if (!validarDataYYYYMMDD(data)) {
        return res.status(400).json({
          error: "Data inválida.",
        });
      }

      const horarioFormatado = formatarHorarioParaBanco(horario);

      const { inicio, fim } = intervaloDoDia(data);

      const conflito = await Agendamento.findOne({
        where: {
          data: {
            [Op.between]: [inicio, fim],
          },
          horario: horarioFormatado,
        },
      });

      if (conflito) {
        return res.status(409).json({
          error: "Este horário já está agendado.",
        });
      }

      const [ano, mes, dia] = data.split("-").map(Number);
      const dataBanco = new Date(ano, mes - 1, dia, 0, 0, 0, 0);

      const agendamento = await Agendamento.create({
        nome_cliente,
        telefone,
        data: dataBanco,
        horario: horarioFormatado,
        servico,
        preco_servico: calcularPrecoServico(servico),
      });

      res.status(201).json(agendamento);
    } catch (error) {
      console.error("Erro ao criar agendamento:", error);
      res.status(500).json({
        error: "Erro ao processar o agendamento.",
      });
    }
  },
);

app.put(
  "/agendamentos/:id",
  verificarToken,
  [
    body("nome_cliente").optional().notEmpty().withMessage("Nome inválido"),
    body("telefone").optional().notEmpty().withMessage("Telefone inválido"),
    body("data")
      .optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage("Formato de data inválido. Use YYYY-MM-DD."),
    body("horario")
      .optional()
      .matches(/^\d{2}:\d{2}(:\d{2})?$/)
      .withMessage("Formato de horário inválido. Use HH:MM."),
    body("servico").optional().notEmpty().withMessage("Serviço inválido"),
  ],
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Erro de validação",
        details: errors.array(),
      });
    }

    try {
      const { id } = req.params;
      const { nome_cliente, telefone, data, horario, servico } = req.body;

      const agendamento = await Agendamento.findByPk(id);

      if (!agendamento) {
        return res.status(404).json({
          error: "Agendamento não encontrado.",
        });
      }

      let novaData = agendamento.data;
      let novoHorario = agendamento.horario;

      if (data) {
        if (!validarDataYYYYMMDD(data)) {
          return res.status(400).json({
            error: "Data inválida.",
          });
        }

        const [ano, mes, dia] = data.split("-").map(Number);
        novaData = new Date(ano, mes - 1, dia, 0, 0, 0, 0);
      }

      if (horario) {
        novoHorario = formatarHorarioParaBanco(horario);
      }

      if (data || horario) {
        const dataConsulta = data
          ? data
          : `${agendamento.data.getFullYear()}-${String(
              agendamento.data.getMonth() + 1,
            ).padStart(2, "0")}-${String(agendamento.data.getDate()).padStart(
              2,
              "0",
            )}`;

        const { inicio, fim } = intervaloDoDia(dataConsulta);

        const conflito = await Agendamento.findOne({
          where: {
            id: {
              [Op.ne]: id,
            },
            data: {
              [Op.between]: [inicio, fim],
            },
            horario: novoHorario,
          },
        });

        if (conflito) {
          return res.status(409).json({
            error: "Este horário já está agendado.",
          });
        }
      }

      // Se o serviço mudou, recalcula o preço automaticamente.
      const novoPreco = servico
        ? calcularPrecoServico(servico)
        : agendamento.preco_servico;

      await agendamento.update({
        nome_cliente: nome_cliente ?? agendamento.nome_cliente,
        telefone: telefone ?? agendamento.telefone,
        data: novaData,
        horario: novoHorario,
        servico: servico ?? agendamento.servico,
        preco_servico: novoPreco,
      });

      res.json(agendamento);
    } catch (error) {
      console.error("Erro ao atualizar agendamento:", error);
      res.status(500).json({
        error: "Erro ao atualizar agendamento.",
      });
    }
  },
);

// Marca (ou desmarca) um agendamento como concluído. É esse status que
// alimenta o faturamento do dia/semana/mês no dashboard.
app.patch(
  "/agendamentos/:id/concluir",
  verificarToken,
  [
    body("concluido")
      .optional()
      .isBoolean()
      .withMessage("concluido deve ser true ou false"),
  ],
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Erro de validação",
        details: errors.array(),
      });
    }

    try {
      const { id } = req.params;
      const { concluido } = req.body;

      const agendamento = await Agendamento.findByPk(id);

      if (!agendamento) {
        return res.status(404).json({
          error: "Agendamento não encontrado.",
        });
      }

      const novoStatus =
        typeof concluido === "boolean" ? concluido : !agendamento.concluido;

      await agendamento.update({ concluido: novoStatus });

      res.json(agendamento);
    } catch (error) {
      console.error("Erro ao atualizar status do agendamento:", error);
      res.status(500).json({
        error: "Erro ao atualizar status do agendamento.",
      });
    }
  },
);

app.delete("/agendamentos/:id", verificarToken, async (req, res) => {
  try {
    const { id } = req.params;

    const agendamento = await Agendamento.findByPk(id);

    if (!agendamento) {
      return res.status(404).json({
        error: "Agendamento não encontrado.",
      });
    }

    await agendamento.destroy();

    res.json({
      message: "Agendamento cancelado com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao deletar agendamento:", error);
    res.status(500).json({
      error: "Erro ao deletar agendamento.",
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: "Rota não encontrada.",
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(500).json({
    error: "Erro interno no servidor.",
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Painel admin: http://localhost:${PORT}/admin.html`);
});
