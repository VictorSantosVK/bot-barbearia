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

/*
============================================================
CONFIGURAÇÃO DE FUSO
============================================================
*/

const TIMEZONE = "America/Sao_Paulo";

/*
============================================================
ADMIN
============================================================
*/

const admin = {
  usuario: ADMIN_USER,
  senhaHash: bcrypt.hashSync(ADMIN_PASSWORD, 8),
};

/*
============================================================
RELACIONAMENTOS
============================================================
*/

Produto.hasMany(Venda, { foreignKey: "produto_id" });
Venda.belongsTo(Produto, { foreignKey: "produto_id" });

/*
============================================================
MIDDLEWARES
============================================================
*/

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
  })
);

app.use(express.static(path.join(__dirname, "public")));

/*
============================================================
BANCO
============================================================
*/

sequelize
  .sync({ force: false })
  .then(() => console.log("Banco de dados sincronizado."))
  .catch((err) => console.error("Erro ao sincronizar o banco de dados:", err));

/*
============================================================
HORÁRIOS
============================================================
*/

const HORARIO_PADRAO = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00",
  "17:30", "18:00", "18:30",
];

const horariosPorDia = {
  segunda: HORARIO_PADRAO,
  terca: HORARIO_PADRAO,
  quarta: HORARIO_PADRAO,
  quinta: HORARIO_PADRAO,
  sexta: HORARIO_PADRAO,
  sabado: HORARIO_PADRAO,
  domingo: [],
};

/*
============================================================
PREÇOS
============================================================
*/

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

/*
============================================================
FUNÇÕES DE DATA

REGRA DE OURO deste arquivo:

  Agendamento.data é DATEONLY. NUNCA construímos um objeto
  Date pra escrever, ler ou comparar esse campo — só strings
  "YYYY-MM-DD". Isso porque o Sequelize formata DATEONLY com
  moment(date).format('YYYY-MM-DD') SEM aplicar o `timezone`
  configurado na conexão — ou seja, ele usa o fuso local do
  processo Node, que muda de servidor pra servidor. Um objeto
  Date sempre reintroduz esse risco; uma string nunca.

  Venda.data e Despesa.data continuam sendo DATE/DATETIME de
  verdade (timestamps), então para eles Date objects + o
  `timezone: "-03:00"` da conexão continuam sendo o jeito
  certo — não mudamos esse comportamento.
============================================================
*/

/**
 * Retorna o dia da semana para uma data YYYY-MM-DD.
 * Não usa new Date("YYYY-MM-DD") (parser local); usa Date.UTC
 * só como calculadora de calendário, nunca como instante real.
 */
function getDiaSemana(dateString) {
  const dias = [
    "domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado",
  ];
  const [ano, mes, dia] = dateString.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return dias[data.getUTCDay()];
}

/**
 * Valida YYYY-MM-DD sem depender do timezone.
 */
function validarDataYYYYMMDD(data) {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return false;
  }

  const [ano, mes, dia] = data.split("-").map(Number);
  const dataUTC = new Date(Date.UTC(ano, mes - 1, dia));

  return (
    dataUTC.getUTCFullYear() === ano &&
    dataUTC.getUTCMonth() === mes - 1 &&
    dataUTC.getUTCDate() === dia
  );
}

/**
 * Converte o que quer que o driver devolva pra coluna DATEONLY
 * em "YYYY-MM-DD". Com dateStrings:['DATE'] configurado no
 * banco (ver config/database.js), isso já chega como string —
 * a checagem de Date fica só como rede de segurança.
 */
function normalizarDataBanco(data) {
  if (!data) return null;

  if (typeof data === "string") {
    return data.substring(0, 10);
  }

  if (data instanceof Date) {
    // Só usado como fallback defensivo — no caminho normal
    // (dateStrings:['DATE']) isso nunca deveria rodar.
    const ano = data.getUTCFullYear();
    const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
    const dia = String(data.getUTCDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  return String(data).substring(0, 10);
}

/**
 * Soma/subtrai dias de uma string "YYYY-MM-DD", devolvendo
 * outra string "YYYY-MM-DD". Puramente aritmético (Date.UTC
 * usado só como calculadora), nunca vira um valor gravado.
 */
function somarDias(dateString, quantidade) {
  const [ano, mes, dia] = dateString.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  d.setUTCDate(d.getUTCDate() + quantidade);

  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * Formata HH:MM para HH:MM:SS.
 */
function formatarHorarioParaBanco(horario) {
  if (!horario) return horario;
  if (/^\d{2}:\d{2}$/.test(horario)) return `${horario}:00`;
  return horario;
}

/**
 * Obtém a data atual no horário de São Paulo como YYYY-MM-DD.
 *
 * IMPORTANTE: NÃO usa Intl.DateTimeFormat({ timeZone: ... }).
 * Builds de Node com "small-icu" (comum em VPS/Docker mínimos)
 * não têm o banco de fusos IANA completo e lançam RangeError
 * ("Invalid time zone specified") ao tentar resolver um fuso
 * pelo nome — foi exatamente isso que derrubou /dashboard em
 * produção. Em vez disso, aplicamos um offset fixo de -03:00
 * na mão: o Brasil não usa mais horário de verão desde 2019,
 * então isso é sempre exato e nunca depende de tzdata/ICU.
 */
const OFFSET_BRASIL_MS = 3 * 60 * 60 * 1000;

function dataAtualSaoPaulo() {
  const agora = new Date(Date.now() - OFFSET_BRASIL_MS);
  const ano = agora.getUTCFullYear();
  const mes = String(agora.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(agora.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/**
 * Intervalo (strings "YYYY-MM-DD") da semana corrente —
 * para usar em comparações contra Agendamento.data (DATEONLY).
 */
function intervaloDaSemanaString() {
  const hoje = dataAtualSaoPaulo();
  const [ano, mes, dia] = hoje.split("-").map(Number);
  const diaSemana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
  const inicio = somarDias(hoje, -diaSemana);
  const fim = somarDias(inicio, 6);
  return { inicio, fim };
}

/**
 * Intervalo (strings "YYYY-MM-DD") do mês corrente —
 * para usar em comparações contra Agendamento.data (DATEONLY).
 */
function intervaloDoMesString() {
  const hoje = dataAtualSaoPaulo();
  const [ano, mes] = hoje.split("-").map(Number);
  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const fim = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { inicio, fim };
}

/**
 * Intervalo em instantes reais (Date/UTC) — usado SÓ para
 * Venda.data / Despesa.data, que são DATE/DATETIME de verdade.
 * Meia-noite em São Paulo (-03:00) equivale a 03:00 UTC.
 */
function limitesDoMesUTC() {
  const { inicio: inicioStr, fim: fimStr } = intervaloDoMesString();

  const [ai, mi, di] = inicioStr.split("-").map(Number);
  const [af, mf, df] = fimStr.split("-").map(Number);

  const inicio = new Date(Date.UTC(ai, mi - 1, di, 0, 0, 0, 0) + OFFSET_BRASIL_MS);
  const fim = new Date(Date.UTC(af, mf - 1, df, 23, 59, 59, 999) + OFFSET_BRASIL_MS);

  return { inicio, fim };
}

/*
============================================================
SERIALIZAÇÃO DOS AGENDAMENTOS
============================================================
*/

function serializarAgendamento(agendamento) {
  const json =
    typeof agendamento.toJSON === "function"
      ? agendamento.toJSON()
      : { ...agendamento };

  json.data = normalizarDataBanco(json.data);

  if (json.horario instanceof Date) {
    json.horario = json.horario.toISOString().substring(11, 19);
  } else if (json.horario) {
    json.horario = String(json.horario).substring(0, 8);
  }

  return json;
}

/*
============================================================
TOKEN
============================================================
*/

function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Token não fornecido." });
  }

  const partes = authHeader.split(" ");

  if (partes.length !== 2 || partes[0] !== "Bearer") {
    return res.status(401).json({ error: "Formato do token inválido." });
  }

  try {
    req.admin = jwt.verify(partes[1], JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
}

/*
============================================================
ROTAS BÁSICAS
============================================================
*/

app.get("/", (req, res) => {
  res.redirect("/admin.html");
});

/*
============================================================
LOGIN
============================================================
*/

app.post(
  "/login",
  [
    body("usuario").notEmpty().withMessage("Usuário é obrigatório"),
    body("senha").notEmpty().withMessage("Senha é obrigatória"),
  ],
  (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Erro de validação", details: errors.array() });
    }

    const { usuario, senha } = req.body;

    const usuarioValido = usuario === admin.usuario;
    const senhaValida = bcrypt.compareSync(senha, admin.senhaHash);

    if (!usuarioValido || !senhaValida) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    const token = jwt.sign(
      { usuario: admin.usuario, role: "admin" },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({ message: "Login bem-sucedido.", token, usuario: admin.usuario });
  }
);

/*
============================================================
ME
============================================================
*/

app.get("/me", verificarToken, (req, res) => {
  res.json({ usuario: req.admin.usuario, role: req.admin.role });
});

/*
============================================================
DASHBOARD
============================================================
*/

app.get("/dashboard", verificarToken, async (req, res) => {
  try {
    const dataHoje = dataAtualSaoPaulo();
    const { inicio: inicioSemana, fim: fimSemana } = intervaloDaSemanaString();
    const { inicio: inicioMes, fim: fimMes } = intervaloDoMesString();

    const totalAgendamentos = await Agendamento.count();

    const agendamentosHoje = await Agendamento.count({
      where: { data: dataHoje },
    });

    const futuros = await Agendamento.count({
      where: { data: { [Op.gte]: dataHoje } },
    });

    const cabelo = await Agendamento.count({ where: { servico: "Cabelo" } });
    const cabeloBarba = await Agendamento.count({ where: { servico: "Cabelo e Barba" } });

    const faturamentoHoje = await Agendamento.sum("preco_servico", {
      where: { concluido: true, data: dataHoje },
    });

    const faturamentoSemana = await Agendamento.sum("preco_servico", {
      where: { concluido: true, data: { [Op.between]: [inicioSemana, fimSemana] } },
    });

    const faturamentoMes = await Agendamento.sum("preco_servico", {
      where: { concluido: true, data: { [Op.between]: [inicioMes, fimMes] } },
    });

    res.json({
      totalAgendamentos,
      agendamentosHoje,
      futuros,
      servicos: { cabelo, cabeloBarba },
      faturamento: {
        hoje: faturamentoHoje || 0,
        semana: faturamentoSemana || 0,
        mes: faturamentoMes || 0,
      },
    });
  } catch (error) {
    console.error("Erro ao carregar dashboard:", error);
    res.status(500).json({ error: "Erro ao carregar dashboard." });
  }
});

/*
============================================================
HORÁRIOS DISPONÍVEIS
============================================================
*/

app.get("/horarios-disponiveis", verificarToken, async (req, res) => {
  try {
    const { data } = req.query;

    if (!validarDataYYYYMMDD(data)) {
      return res.status(400).json({ error: "Formato de data inválido. Use YYYY-MM-DD." });
    }

    const diaSemana = getDiaSemana(data);
    const horariosDisponiveis = horariosPorDia[diaSemana] || [];

    const agendamentos = await Agendamento.findAll({
      where: { data },
      attributes: ["horario"],
    });

    const horariosAgendados = agendamentos.map((a) =>
      a.horario ? String(a.horario).substring(0, 5) : null
    );

    const horariosLivres = horariosDisponiveis.filter(
      (horario) => !horariosAgendados.includes(horario)
    );

    res.json({ data, diaSemana, horariosDisponiveis, horariosAgendados, horariosLivres });
  } catch (error) {
    console.error("Erro ao buscar horários:", error);
    res.status(500).json({ error: "Erro ao buscar horários disponíveis." });
  }
});

/*
============================================================
LISTAR AGENDAMENTOS
============================================================
*/

app.get("/agendamentos", verificarToken, async (req, res) => {
  try {
    const { data, cliente, servico } = req.query;
    const where = {};

    if (data) {
      if (!validarDataYYYYMMDD(data)) {
        return res.status(400).json({ error: "Formato de data inválido. Use YYYY-MM-DD." });
      }
      where.data = data;
    }

    if (cliente) {
      where.nome_cliente = { [Op.like]: `%${cliente}%` };
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

    res.json(agendamentos.map(serializarAgendamento));
  } catch (error) {
    console.error("Erro ao listar agendamentos:", error);
    res.status(500).json({ error: "Erro ao listar agendamentos." });
  }
});

/*
============================================================
BUSCAR AGENDAMENTO
============================================================
*/

app.get("/agendamentos/:id", verificarToken, async (req, res) => {
  try {
    const { id } = req.params;

    const agendamento = await Agendamento.findByPk(id);

    if (!agendamento) {
      return res.status(404).json({ error: "Agendamento não encontrado." });
    }

    res.json(serializarAgendamento(agendamento));
  } catch (error) {
    console.error("Erro ao buscar agendamento:", error);
    res.status(500).json({ error: "Erro ao buscar agendamento." });
  }
});

/*
============================================================
CRIAR AGENDAMENTO
============================================================
*/

app.post(
  "/agendamentos",
  verificarToken,
  [
    body("nome_cliente").notEmpty().withMessage("Nome do cliente é obrigatório"),
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
      return res.status(400).json({ error: "Erro de validação", details: errors.array() });
    }

    try {
      const { nome_cliente, telefone, data, horario, servico } = req.body;

      if (!validarDataYYYYMMDD(data)) {
        return res.status(400).json({ error: "Data inválida." });
      }

      const horarioFormatado = formatarHorarioParaBanco(horario);

      // Conflito: comparação direta de strings — nada de Date aqui.
      const conflito = await Agendamento.findOne({
        where: { data, horario: horarioFormatado },
      });

      if (conflito) {
        return res.status(409).json({ error: "Este horário já está agendado." });
      }

      // "data" já é a string validada "YYYY-MM-DD" — vai direto
      // pra coluna DATEONLY, sem passar por nenhum objeto Date.
      const agendamento = await Agendamento.create({
        nome_cliente,
        telefone,
        data,
        horario: horarioFormatado,
        servico,
        preco_servico: calcularPrecoServico(servico),
      });

      res.status(201).json(serializarAgendamento(agendamento));
    } catch (error) {
      console.error("Erro ao criar agendamento:", error);
      res.status(500).json({ error: "Erro ao processar o agendamento." });
    }
  }
);

/*
============================================================
ATUALIZAR AGENDAMENTO

Regras:
- Se o usuário não mandar `data`, a coluna `data` nem entra
  no payload do update (fica intocada).
- Se mandar `data`, gravamos a STRING recebida direto —
  nunca um objeto Date (é isso que causava o bug em produção).
============================================================
*/

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
      return res.status(400).json({ error: "Erro de validação.", details: errors.array() });
    }

    try {
      const { id } = req.params;
      const { nome_cliente, telefone, data, horario, servico } = req.body;

      const agendamento = await Agendamento.findByPk(id);

      if (!agendamento) {
        return res.status(404).json({ error: "Agendamento não encontrado." });
      }

      const dataOriginal = normalizarDataBanco(agendamento.data);

      let dataFinal = dataOriginal;
      if (data !== undefined) {
        if (!validarDataYYYYMMDD(data)) {
          return res.status(400).json({ error: "Data inválida." });
        }
        dataFinal = data;
      }

      let horarioFinal = agendamento.horario;
      if (horario !== undefined) {
        horarioFinal = formatarHorarioParaBanco(horario);
      }

      // Conflito: comparação direta de strings — nada de Date aqui.
      const conflito = await Agendamento.findOne({
        where: {
          id: { [Op.ne]: id },
          data: dataFinal,
          horario: horarioFinal,
        },
      });

      if (conflito) {
        console.log("CONFLITO DE AGENDAMENTO:", {
          idAtual: id,
          conflitoId: conflito.id,
          data: dataFinal,
          horario: horarioFinal,
        });

        return res.status(409).json({
          error: "Este horário já está agendado.",
          conflito: {
            id: conflito.id,
            nome_cliente: conflito.nome_cliente,
            data: normalizarDataBanco(conflito.data),
            horario: conflito.horario,
          },
        });
      }

      const novoPreco =
        servico !== undefined ? calcularPrecoServico(servico) : agendamento.preco_servico;

      const dadosAtualizacao = {
        nome_cliente: nome_cliente ?? agendamento.nome_cliente,
        telefone: telefone ?? agendamento.telefone,
        horario: horarioFinal,
        servico: servico ?? agendamento.servico,
        preco_servico: novoPreco,
      };

      // Só grava `data` se o usuário realmente mandou uma nova —
      // e grava a STRING recebida, nunca um objeto Date.
      if (data !== undefined) {
        dadosAtualizacao.data = data;
      }

      await agendamento.update(dadosAtualizacao);

      console.log("AGENDAMENTO ATUALIZADO:", {
        id,
        dataAnterior: dataOriginal,
        dataNova: dataFinal,
        horarioNovo: horarioFinal,
        dataFoiAlterada: data !== undefined,
      });

      res.json(serializarAgendamento(agendamento));
    } catch (error) {
      console.error("Erro ao atualizar agendamento:", error);
      res.status(500).json({ error: "Erro ao atualizar agendamento." });
    }
  }
);

/*
============================================================
CONCLUIR AGENDAMENTO
============================================================
*/

app.patch(
  "/agendamentos/:id/concluir",
  verificarToken,
  [body("concluido").optional().isBoolean().withMessage("concluido deve ser true ou false")],
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Erro de validação", details: errors.array() });
    }

    try {
      const { id } = req.params;
      const { concluido } = req.body;

      const agendamento = await Agendamento.findByPk(id);

      if (!agendamento) {
        return res.status(404).json({ error: "Agendamento não encontrado." });
      }

      const novoStatus = typeof concluido === "boolean" ? concluido : !agendamento.concluido;

      await agendamento.update({ concluido: novoStatus });

      res.json(serializarAgendamento(agendamento));
    } catch (error) {
      console.error("Erro ao atualizar status do agendamento:", error);
      res.status(500).json({ error: "Erro ao atualizar status do agendamento." });
    }
  }
);

/*
============================================================
DELETAR AGENDAMENTO
============================================================
*/

app.delete("/agendamentos/:id", verificarToken, async (req, res) => {
  try {
    const agendamento = await Agendamento.findByPk(req.params.id);

    if (!agendamento) {
      return res.status(404).json({ error: "Agendamento não encontrado." });
    }

    await agendamento.destroy();

    res.json({ message: "Agendamento cancelado com sucesso." });
  } catch (error) {
    console.error("Erro ao deletar agendamento:", error);
    res.status(500).json({ error: "Erro ao deletar agendamento." });
  }
});

/*
============================================================
PRODUTOS
============================================================
*/

app.get("/produtos", verificarToken, async (req, res) => {
  try {
    const produtos = await Produto.findAll({ order: [["nome", "ASC"]] });
    res.json(produtos);
  } catch (error) {
    console.error("Erro ao listar produtos:", error);
    res.status(500).json({ error: "Erro ao listar produtos." });
  }
});

app.get("/produtos/:id", verificarToken, async (req, res) => {
  try {
    const produto = await Produto.findByPk(req.params.id);

    if (!produto) {
      return res.status(404).json({ error: "Produto não encontrado." });
    }

    res.json(produto);
  } catch (error) {
    console.error("Erro ao buscar produto:", error);
    res.status(500).json({ error: "Erro ao buscar produto." });
  }
});

app.post(
  "/produtos",
  verificarToken,
  [
    body("nome").notEmpty().withMessage("Nome do produto é obrigatório."),
    body("preco_custo").optional().isFloat({ min: 0 }).withMessage("Preço de custo inválido."),
    body("preco_venda").notEmpty().isFloat({ min: 0 }).withMessage("Preço de venda inválido."),
    body("estoque").optional().isInt({ min: 0 }).withMessage("Estoque inválido."),
    body("estoque_minimo").optional().isInt({ min: 0 }).withMessage("Estoque mínimo inválido."),
  ],
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Erro de validação.", details: errors.array() });
    }

    try {
      const { nome, descricao, preco_custo, preco_venda, estoque, estoque_minimo } = req.body;

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
      res.status(500).json({ error: "Erro ao cadastrar produto." });
    }
  }
);

app.put("/produtos/:id", verificarToken, async (req, res) => {
  try {
    const produto = await Produto.findByPk(req.params.id);

    if (!produto) {
      return res.status(404).json({ error: "Produto não encontrado." });
    }

    const { nome, descricao, preco_custo, preco_venda, estoque, estoque_minimo, ativo } = req.body;

    await produto.update({
      nome: nome ?? produto.nome,
      descricao: descricao ?? produto.descricao,
      preco_custo: preco_custo !== undefined ? Number(preco_custo) : produto.preco_custo,
      preco_venda: preco_venda !== undefined ? Number(preco_venda) : produto.preco_venda,
      estoque: estoque !== undefined ? Number(estoque) : produto.estoque,
      estoque_minimo:
        estoque_minimo !== undefined ? Number(estoque_minimo) : produto.estoque_minimo,
      ativo: ativo !== undefined ? Boolean(ativo) : produto.ativo,
    });

    res.json(produto);
  } catch (error) {
    console.error("Erro ao atualizar produto:", error);
    res.status(500).json({ error: "Erro ao atualizar produto." });
  }
});

app.delete("/produtos/:id", verificarToken, async (req, res) => {
  try {
    const produto = await Produto.findByPk(req.params.id);

    if (!produto) {
      return res.status(404).json({ error: "Produto não encontrado." });
    }

    const vendas = await Venda.count({ where: { produto_id: produto.id } });

    if (vendas > 0) {
      return res.status(400).json({
        error:
          "Este produto possui vendas registradas e não pode ser excluído. Desative o produto em vez de excluí-lo.",
      });
    }

    await produto.destroy();

    res.json({ message: "Produto excluído com sucesso." });
  } catch (error) {
    console.error("Erro ao excluir produto:", error);
    res.status(500).json({ error: "Erro ao excluir produto." });
  }
});

/*
============================================================
VENDAS
============================================================
*/

app.get("/vendas", verificarToken, async (req, res) => {
  try {
    const vendas = await Venda.findAll({
      include: [{ model: Produto, attributes: ["id", "nome"] }],
      order: [["data", "DESC"]],
    });

    res.json(vendas);
  } catch (error) {
    console.error("Erro ao listar vendas:", error);
    res.status(500).json({ error: "Erro ao listar vendas." });
  }
});

app.post(
  "/vendas",
  verificarToken,
  [
    body("produto_id").notEmpty().isInt().withMessage("Produto inválido."),
    body("quantidade").notEmpty().isInt({ min: 1 }).withMessage("Quantidade inválida."),
  ],
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Erro de validação.", details: errors.array() });
    }

    try {
      const { produto_id, quantidade } = req.body;

      const produto = await Produto.findByPk(produto_id);

      if (!produto) {
        return res.status(404).json({ error: "Produto não encontrado." });
      }

      if (!produto.ativo) {
        return res.status(400).json({ error: "Este produto está desativado." });
      }

      const qtd = Number(quantidade);

      if (produto.estoque < qtd) {
        return res
          .status(400)
          .json({ error: `Estoque insuficiente. Estoque atual: ${produto.estoque}.` });
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

      await produto.update({ estoque: produto.estoque - qtd });

      const vendaCompleta = await Venda.findByPk(venda.id, {
        include: [{ model: Produto, attributes: ["id", "nome"] }],
      });

      res.status(201).json(vendaCompleta);
    } catch (error) {
      console.error("Erro ao registrar venda:", error);
      res.status(500).json({ error: "Erro ao registrar venda." });
    }
  }
);

/*
============================================================
DESPESAS
============================================================
*/

app.get("/despesas", verificarToken, async (req, res) => {
  try {
    const despesas = await Despesa.findAll({ order: [["data", "DESC"]] });
    res.json(despesas);
  } catch (error) {
    console.error("Erro ao listar despesas:", error);
    res.status(500).json({ error: "Erro ao listar despesas." });
  }
});

app.post(
  "/despesas",
  verificarToken,
  [
    body("descricao").notEmpty().withMessage("Descrição da despesa é obrigatória."),
    body("valor").notEmpty().isFloat({ min: 0 }).withMessage("Valor da despesa inválido."),
  ],
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Erro de validação.", details: errors.array() });
    }

    try {
      const { descricao, categoria, valor, data } = req.body;

      // Despesa.data é DATE/DATETIME de verdade — aqui um objeto
      // Date + o timezone da conexão é o jeito certo (diferente
      // do Agendamento.data, que é DATEONLY).
      const despesa = await Despesa.create({
        descricao,
        categoria: categoria || null,
        valor: Number(valor),
        data: data ? new Date(`${data}T00:00:00-03:00`) : new Date(),
      });

      res.status(201).json(despesa);
    } catch (error) {
      console.error("Erro ao cadastrar despesa:", error);
      res.status(500).json({ error: "Erro ao cadastrar despesa." });
    }
  }
);

app.delete("/despesas/:id", verificarToken, async (req, res) => {
  try {
    const despesa = await Despesa.findByPk(req.params.id);

    if (!despesa) {
      return res.status(404).json({ error: "Despesa não encontrada." });
    }

    await despesa.destroy();

    res.json({ message: "Despesa excluída com sucesso." });
  } catch (error) {
    console.error("Erro ao excluir despesa:", error);
    res.status(500).json({ error: "Erro ao excluir despesa." });
  }
});

/*
============================================================
FINANCEIRO
============================================================
*/

app.get("/financeiro", verificarToken, async (req, res) => {
  try {
    // Venda/Despesa são DATETIME de verdade -> limites em Date/UTC.
    const { inicio: inicioMesUTC, fim: fimMesUTC } = limitesDoMesUTC();

    // Agendamento.data é DATEONLY -> limites em string.
    const { inicio: inicioMesStr, fim: fimMesStr } = intervaloDoMesString();

    const vendas = await Venda.findAll({
      where: { data: { [Op.between]: [inicioMesUTC, fimMesUTC] } },
    });

    const agendamentosConcluidos = await Agendamento.findAll({
      where: { concluido: true, data: { [Op.between]: [inicioMesStr, fimMesStr] } },
    });

    const despesas = await Despesa.findAll({
      where: { data: { [Op.between]: [inicioMesUTC, fimMesUTC] } },
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

    const produtos = await Produto.findAll();

    let valorEstoque = 0;
    let quantidadeEstoque = 0;

    for (const produto of produtos) {
      valorEstoque += Number(produto.preco_custo) * Number(produto.estoque);
      quantidadeEstoque += Number(produto.estoque);
    }

    res.json({
      periodo: { inicio: inicioMesStr, fim: fimMesStr },
      faturamento: {
        produtos: faturamentoProdutos,
        servicos: faturamentoServicos,
        total: faturamentoTotal,
      },
      custos: { produtos: custoProdutos },
      despesas: totalDespesas,
      lucro: { bruto: lucroBruto, liquido: lucroLiquido },
      estoque: { quantidade: quantidadeEstoque, valor: valorEstoque },
      quantidade: {
        vendasProdutos: vendas.length,
        servicosConcluidos: agendamentosConcluidos.length,
        despesas: despesas.length,
      },
    });
  } catch (error) {
    console.error("Erro ao carregar financeiro:", error);
    res.status(500).json({ error: "Erro ao carregar informações financeiras." });
  }
});

/*
============================================================
404
============================================================
*/

app.use((req, res) => {
  res.status(404).json({ error: "Rota não encontrada." });
});

/*
============================================================
ERRO GLOBAL
============================================================
*/

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Erro interno no servidor." });
});

/*
============================================================
SERVIDOR
============================================================
*/

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Timezone da aplicação: ${TIMEZONE}`);
  console.log(`Hoje (São Paulo): ${dataAtualSaoPaulo()}`);
  console.log(`Painel admin: http://localhost:${PORT}/admin.html`);
});