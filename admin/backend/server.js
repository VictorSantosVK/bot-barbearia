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
const Produto = require("../../models/Produto");
const Venda = require("../../models/Venda");
const Despesa = require("../../models/Despesa");
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

Produto.hasMany(Venda, {
  foreignKey: "produto_id",
});

Venda.belongsTo(Produto, {
  foreignKey: "produto_id",
});

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

// ============================================================
// PRODUTOS
// ============================================================

// Listar produtos
app.get("/produtos", verificarToken, async (req, res) => {
  try {
    const produtos = await Produto.findAll({
      order: [["nome", "ASC"]],
    });

    res.json(produtos);
  } catch (error) {
    console.error("Erro ao listar produtos:", error);

    res.status(500).json({
      error: "Erro ao listar produtos.",
    });
  }
});

// Buscar um produto
app.get("/produtos/:id", verificarToken, async (req, res) => {
  try {
    const produto = await Produto.findByPk(req.params.id);

    if (!produto) {
      return res.status(404).json({
        error: "Produto não encontrado.",
      });
    }

    res.json(produto);
  } catch (error) {
    console.error("Erro ao buscar produto:", error);

    res.status(500).json({
      error: "Erro ao buscar produto.",
    });
  }
});

// Cadastrar produto
app.post(
  "/produtos",
  verificarToken,
  [
    body("nome").notEmpty().withMessage("Nome do produto é obrigatório."),

    body("preco_custo")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Preço de custo inválido."),

    body("preco_venda")
      .notEmpty()
      .isFloat({ min: 0 })
      .withMessage("Preço de venda inválido."),

    body("estoque")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Estoque inválido."),

    body("estoque_minimo")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Estoque mínimo inválido."),
  ],
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Erro de validação.",
        details: errors.array(),
      });
    }

    try {
      const {
        nome,
        descricao,
        preco_custo,
        preco_venda,
        estoque,
        estoque_minimo,
      } = req.body;

      const produto = await Produto.create({
        nome,
        descricao: descricao || null,
        preco_custo: Number(preco_custo) || 0,
        preco_venda: Number(preco_venda) || 0,
        estoque: Number(estoque) || 0,
        estoque_minimo: Number(estoque_minimo) || 0,
        ativo: true,
      });

      res.status(201).json(produto);
    } catch (error) {
      console.error("Erro ao cadastrar produto:", error);

      res.status(500).json({
        error: "Erro ao cadastrar produto.",
      });
    }
  },
);

// Alterar produto
app.put("/produtos/:id", verificarToken, async (req, res) => {
  try {
    const produto = await Produto.findByPk(req.params.id);

    if (!produto) {
      return res.status(404).json({
        error: "Produto não encontrado.",
      });
    }

    const {
      nome,
      descricao,
      preco_custo,
      preco_venda,
      estoque,
      estoque_minimo,
      ativo,
    } = req.body;

    await produto.update({
      nome: nome ?? produto.nome,
      descricao: descricao ?? produto.descricao,
      preco_custo:
        preco_custo !== undefined ? Number(preco_custo) : produto.preco_custo,
      preco_venda:
        preco_venda !== undefined ? Number(preco_venda) : produto.preco_venda,
      estoque: estoque !== undefined ? Number(estoque) : produto.estoque,
      estoque_minimo:
        estoque_minimo !== undefined
          ? Number(estoque_minimo)
          : produto.estoque_minimo,
      ativo: ativo !== undefined ? Boolean(ativo) : produto.ativo,
    });

    res.json(produto);
  } catch (error) {
    console.error("Erro ao atualizar produto:", error);

    res.status(500).json({
      error: "Erro ao atualizar produto.",
    });
  }
});

// Excluir produto
app.delete("/produtos/:id", verificarToken, async (req, res) => {
  try {
    const produto = await Produto.findByPk(req.params.id);

    if (!produto) {
      return res.status(404).json({
        error: "Produto não encontrado.",
      });
    }

    const vendas = await Venda.count({
      where: {
        produto_id: produto.id,
      },
    });

    // Não deixa apagar um produto que já possui vendas.
    if (vendas > 0) {
      return res.status(400).json({
        error:
          "Este produto possui vendas registradas e não pode ser excluído. Desative o produto em vez de excluí-lo.",
      });
    }

    await produto.destroy();

    res.json({
      message: "Produto excluído com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao excluir produto:", error);

    res.status(500).json({
      error: "Erro ao excluir produto.",
    });
  }
});

// ============================================================
// VENDAS
// ============================================================

// Listar vendas
app.get("/vendas", verificarToken, async (req, res) => {
  try {
    const vendas = await Venda.findAll({
      include: [
        {
          model: Produto,
          attributes: ["id", "nome"],
        },
      ],
      order: [["data", "DESC"]],
    });

    res.json(vendas);
  } catch (error) {
    console.error("Erro ao listar vendas:", error);

    res.status(500).json({
      error: "Erro ao listar vendas.",
    });
  }
});

// Registrar venda
app.post(
  "/vendas",
  verificarToken,
  [
    body("produto_id").notEmpty().isInt().withMessage("Produto inválido."),

    body("quantidade")
      .notEmpty()
      .isInt({ min: 1 })
      .withMessage("Quantidade inválida."),
  ],
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Erro de validação.",
        details: errors.array(),
      });
    }

    try {
      const { produto_id, quantidade } = req.body;

      const produto = await Produto.findByPk(produto_id);

      if (!produto) {
        return res.status(404).json({
          error: "Produto não encontrado.",
        });
      }

      if (!produto.ativo) {
        return res.status(400).json({
          error: "Este produto está desativado.",
        });
      }

      const qtd = Number(quantidade);

      if (produto.estoque < qtd) {
        return res.status(400).json({
          error: `Estoque insuficiente. Estoque atual: ${produto.estoque}.`,
        });
      }

      const valorUnitario = Number(produto.preco_venda);
      const valorTotal = valorUnitario * qtd;

      const venda = await Venda.create({
        produto_id: produto.id,
        quantidade: qtd,
        valor_unitario: valorUnitario,
        valor_total: valorTotal,
        data: new Date(),
      });

      // Baixa automática no estoque.
      await produto.update({
        estoque: produto.estoque - qtd,
      });

      const vendaCompleta = await Venda.findByPk(venda.id, {
        include: [
          {
            model: Produto,
            attributes: ["id", "nome"],
          },
        ],
      });

      res.status(201).json(vendaCompleta);
    } catch (error) {
      console.error("Erro ao registrar venda:", error);

      res.status(500).json({
        error: "Erro ao registrar venda.",
      });
    }
  },
);

// ============================================================
// DESPESAS
// ============================================================

// Listar despesas
app.get("/despesas", verificarToken, async (req, res) => {
  try {
    const despesas = await Despesa.findAll({
      order: [["data", "DESC"]],
    });

    res.json(despesas);
  } catch (error) {
    console.error("Erro ao listar despesas:", error);

    res.status(500).json({
      error: "Erro ao listar despesas.",
    });
  }
});

// Cadastrar despesa
app.post(
  "/despesas",
  verificarToken,
  [
    body("descricao")
      .notEmpty()
      .withMessage("Descrição da despesa é obrigatória."),

    body("valor")
      .notEmpty()
      .isFloat({ min: 0 })
      .withMessage("Valor da despesa inválido."),
  ],
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Erro de validação.",
        details: errors.array(),
      });
    }

    try {
      const { descricao, categoria, valor, data } = req.body;

      const despesa = await Despesa.create({
        descricao,
        categoria: categoria || null,
        valor: Number(valor),
        data: data ? new Date(data) : new Date(),
      });

      res.status(201).json(despesa);
    } catch (error) {
      console.error("Erro ao cadastrar despesa:", error);

      res.status(500).json({
        error: "Erro ao cadastrar despesa.",
      });
    }
  },
);

// Excluir despesa
app.delete("/despesas/:id", verificarToken, async (req, res) => {
  try {
    const despesa = await Despesa.findByPk(req.params.id);

    if (!despesa) {
      return res.status(404).json({
        error: "Despesa não encontrada.",
      });
    }

    await despesa.destroy();

    res.json({
      message: "Despesa excluída com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao excluir despesa:", error);

    res.status(500).json({
      error: "Erro ao excluir despesa.",
    });
  }
});

// ============================================================
// FINANCEIRO
// ============================================================

app.get("/financeiro", verificarToken, async (req, res) => {
  try {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const fimMes = new Date();
    fimMes.setMonth(fimMes.getMonth() + 1);
    fimMes.setDate(0);
    fimMes.setHours(23, 59, 59, 999);

    // Vendas de produtos no mês
    const vendas = await Venda.findAll({
      where: {
        data: {
          [Op.between]: [inicioMes, fimMes],
        },
      },
    });

    // Serviços concluídos no mês
    const agendamentosConcluidos = await Agendamento.findAll({
      where: {
        concluido: true,
        data: {
          [Op.between]: [inicioMes, fimMes],
        },
      },
    });

    // Despesas do mês
    const despesas = await Despesa.findAll({
      where: {
        data: {
          [Op.between]: [inicioMes, fimMes],
        },
      },
    });

    let faturamentoProdutos = 0;
    let custoProdutos = 0;

    for (const venda of vendas) {
      faturamentoProdutos += Number(venda.valor_total);

      const produto = await Produto.findByPk(venda.produto_id);

      if (produto) {
        custoProdutos += Number(produto.preco_custo) * Number(venda.quantidade);
      }
    }

    let faturamentoServicos = 0;

    for (const agendamento of agendamentosConcluidos) {
      faturamentoServicos += Number(agendamento.preco_servico || 0);
    }

    let totalDespesas = 0;

    for (const despesa of despesas) {
      totalDespesas += Number(despesa.valor);
    }

    const faturamentoTotal = faturamentoProdutos + faturamentoServicos;

    const lucroBruto = faturamentoTotal - custoProdutos;

    const lucroLiquido = lucroBruto - totalDespesas;

    // Valor atual investido no estoque.
    const produtos = await Produto.findAll();

    let valorEstoque = 0;
    let quantidadeEstoque = 0;

    for (const produto of produtos) {
      valorEstoque += Number(produto.preco_custo) * Number(produto.estoque);

      quantidadeEstoque += Number(produto.estoque);
    }

    res.json({
      periodo: {
        inicio: inicioMes,
        fim: fimMes,
      },

      faturamento: {
        produtos: faturamentoProdutos,
        servicos: faturamentoServicos,
        total: faturamentoTotal,
      },

      custos: {
        produtos: custoProdutos,
      },

      despesas: totalDespesas,

      lucro: {
        bruto: lucroBruto,
        liquido: lucroLiquido,
      },

      estoque: {
        quantidade: quantidadeEstoque,
        valor: valorEstoque,
      },

      quantidade: {
        vendasProdutos: vendas.length,
        servicosConcluidos: agendamentosConcluidos.length,
        despesas: despesas.length,
      },
    });
  } catch (error) {
    console.error("Erro ao carregar financeiro:", error);

    res.status(500).json({
      error: "Erro ao carregar informações financeiras.",
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
