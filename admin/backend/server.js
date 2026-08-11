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
  })
);

app.use(express.static(path.join(__dirname, "..")));

const TIMEZONE = "America/Sao_Paulo";

/* =========================================================
   FUNÇÕES DE DATA/HORA
   ========================================================= */

/*
 * IMPORTANTE:
 * As datas dos agendamentos são tratadas como DATA DE CALENDÁRIO.
 *
 * Exemplo:
 * 2026-08-10
 *
 * Não devemos transformar isso em:
 *
 * new Date("2026-08-10")
 *
 * porque o JavaScript pode interpretar isso em UTC e,
 * dependendo da conversão, acabar mostrando 2026-08-09.
 */

function normalizarDataString(valor) {
  if (valor === null || valor === undefined) {
    return null;
  }

  if (typeof valor === "string") {
    const match = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }

  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const ano = valor.getFullYear();
    const mes = String(valor.getMonth() + 1).padStart(2, "0");
    const dia = String(valor.getDate()).padStart(2, "0");

    return `${ano}-${mes}-${dia}`;
  }

  return null;
}

function validarDataYYYYMMDD(data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return false;
  }

  const [ano, mes, dia] = data.split("-").map(Number);

  const d = new Date(ano, mes - 1, dia);

  return (
    d.getFullYear() === ano &&
    d.getMonth() === mes - 1 &&
    d.getDate() === dia
  );
}

function normalizarHorarioString(valor) {
  if (valor === null || valor === undefined) {
    return null;
  }

  const texto = String(valor).trim();

  const match = texto.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

  if (!match) {
    return null;
  }

  const hora = Number(match[1]);
  const minuto = Number(match[2]);
  const segundo = match[3] ? Number(match[3]) : 0;

  if (
    hora < 0 ||
    hora > 23 ||
    minuto < 0 ||
    minuto > 59 ||
    segundo < 0 ||
    segundo > 59
  ) {
    return null;
  }

  return `${String(hora).padStart(2, "0")}:${String(minuto).padStart(
    2,
    "0"
  )}:${String(segundo).padStart(2, "0")}`;
}

/*
 * Converte a data de calendário para o formato que o MySQL
 * espera, SEM passar por UTC.
 *
 * 2026-08-10
 * ->
 * 2026-08-10 00:00:00
 */
function dataParaMySQL(data) {
  const dataNormalizada = normalizarDataString(data);

  if (!dataNormalizada) {
    return null;
  }

  return `${dataNormalizada} 00:00:00`;
}

/*
 * Retorna somente YYYY-MM-DD para o frontend.
 *
 * Nunca usamos toISOString() aqui.
 */
function dataParaFrontend(valor) {
  return normalizarDataString(valor);
}

/* =========================================================
   AUTENTICAÇÃO
   ========================================================= */

function autenticar(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({
      erro: "Token não fornecido",
    });
  }

  const token = header.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    req.usuario = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      erro: "Token inválido ou expirado",
    });
  }
}

/* =========================================================
   LOGIN
   ========================================================= */

app.post(
  "/login",
  [
    body("usuario").trim().notEmpty(),
    body("senha").notEmpty(),
  ],
  (req, res) => {
    const erros = validationResult(req);

    if (!erros.isEmpty()) {
      return res.status(400).json({
        erro: "Dados inválidos",
        detalhes: erros.array(),
      });
    }

    const { usuario, senha } = req.body;

    if (usuario !== admin.usuario) {
      return res.status(401).json({
        erro: "Usuário ou senha inválidos",
      });
    }

    const senhaValida = bcrypt.compareSync(senha, admin.senhaHash);

    if (!senhaValida) {
      return res.status(401).json({
        erro: "Usuário ou senha inválidos",
      });
    }

    const token = jwt.sign(
      {
        usuario: admin.usuario,
      },
      JWT_SECRET,
      {
        expiresIn: "12h",
      }
    );

    return res.json({
      sucesso: true,
      token,
      usuario: admin.usuario,
    });
  }
);

/* =========================================================
   HEALTH CHECK
   ========================================================= */

app.get("/health", async (req, res) => {
  try {
    await sequelize.authenticate();

    return res.json({
      status: "ok",
      banco: "conectado",
      timezone: TIMEZONE,
      servidor: new Date().toString(),
    });
  } catch (error) {
    console.error("Erro no health check:", error);

    return res.status(500).json({
      status: "erro",
      banco: "desconectado",
    });
  }
});

/* =========================================================
   AGENDAMENTOS - LISTAR
   ========================================================= */

app.get("/agendamentos", autenticar, async (req, res) => {
  try {
    const agendamentos = await Agendamento.findAll({
      order: [
        ["data", "ASC"],
        ["horario", "ASC"],
      ],
    });

    const resultado = agendamentos.map((agendamento) => {
      const json = agendamento.toJSON();

      return {
        ...json,
        data: dataParaFrontend(json.data),
        horario: normalizarHorarioString(json.horario),
      };
    });

    return res.json(resultado);
  } catch (error) {
    console.error("Erro ao listar agendamentos:", error);

    return res.status(500).json({
      erro: "Erro ao listar agendamentos",
      detalhes: error.message,
    });
  }
});

/* =========================================================
   AGENDAMENTOS - BUSCAR POR ID
   ========================================================= */

app.get("/agendamentos/:id", autenticar, async (req, res) => {
  try {
    const { id } = req.params;

    const agendamento = await Agendamento.findByPk(id);

    if (!agendamento) {
      return res.status(404).json({
        erro: "Agendamento não encontrado",
      });
    }

    const json = agendamento.toJSON();

    return res.json({
      ...json,
      data: dataParaFrontend(json.data),
      horario: normalizarHorarioString(json.horario),
    });
  } catch (error) {
    console.error("Erro ao buscar agendamento:", error);

    return res.status(500).json({
      erro: "Erro ao buscar agendamento",
      detalhes: error.message,
    });
  }
});

/* =========================================================
   AGENDAMENTOS - CRIAR
   ========================================================= */

app.post("/agendamentos", autenticar, async (req, res) => {
  try {
    const {
      nome_cliente,
      telefone,
      data,
      horario,
      servico,
      preco_servico,
      concluido,
    } = req.body;

    const dataNormalizada = normalizarDataString(data);
    const horarioNormalizado = normalizarHorarioString(horario);

    if (!nome_cliente) {
      return res.status(400).json({
        erro: "Nome do cliente é obrigatório",
      });
    }

    if (!telefone) {
      return res.status(400).json({
        erro: "Telefone é obrigatório",
      });
    }

    if (!dataNormalizada || !validarDataYYYYMMDD(dataNormalizada)) {
      return res.status(400).json({
        erro: "Data inválida. Use o formato YYYY-MM-DD.",
      });
    }

    if (!horarioNormalizado) {
      return res.status(400).json({
        erro: "Horário inválido. Use o formato HH:mm ou HH:mm:ss.",
      });
    }

    if (!servico) {
      return res.status(400).json({
        erro: "Serviço é obrigatório",
      });
    }

    /*
     * AQUI ESTÁ UMA DAS CORREÇÕES IMPORTANTES:
     *
     * A data NÃO é criada com new Date(data).
     *
     * Ela é enviada diretamente ao MySQL como:
     *
     * 2026-08-10 00:00:00
     */
    const dataMySQL = dataParaMySQL(dataNormalizada);

    const conflito = await Agendamento.findOne({
      where: sequelize.where(
        sequelize.fn("DATE", sequelize.col("data")),
        dataNormalizada
      ),
      // O horário continua sendo comparado normalmente.
      // O campo data é comparado usando DATE().
      // Isso evita qualquer efeito de timezone.
    });

    if (conflito) {
      const horarioConflito = normalizarHorarioString(conflito.horario);

      if (horarioConflito === horarioNormalizado) {
        return res.status(409).json({
          erro: "Já existe um agendamento para esta data e horário.",
          agendamento: {
            id: conflito.id,
            nome_cliente: conflito.nome_cliente,
            data: dataParaFrontend(conflito.data),
            horario: horarioConflito,
          },
        });
      }
    }

    const novoAgendamento = await Agendamento.create({
      nome_cliente,
      telefone,
      data: dataMySQL,
      horario: horarioNormalizado,
      servico,
      preco_servico:
        preco_servico !== undefined && preco_servico !== null
          ? Number(preco_servico)
          : 0,
      concluido:
        concluido !== undefined && concluido !== null
          ? Boolean(concluido)
          : false,
    });

    console.log("AGENDAMENTO CRIADO:", {
      id: novoAgendamento.id,
      dataRecebida: data,
      dataNormalizada,
      dataGravada: dataMySQL,
      horario: horarioNormalizado,
    });

    const json = novoAgendamento.toJSON();

    return res.status(201).json({
      ...json,
      data: dataParaFrontend(json.data),
      horario: normalizarHorarioString(json.horario),
    });
  } catch (error) {
    console.error("Erro ao criar agendamento:", error);

    return res.status(500).json({
      erro: "Erro ao criar agendamento",
      detalhes: error.message,
    });
  }
});

/* =========================================================
   AGENDAMENTOS - ATUALIZAR
   ========================================================= */

app.put("/agendamentos/:id", autenticar, async (req, res) => {
  try {
    const { id } = req.params;

    const agendamento = await Agendamento.findByPk(id);

    if (!agendamento) {
      return res.status(404).json({
        erro: "Agendamento não encontrado",
      });
    }

    const {
      nome_cliente,
      telefone,
      data,
      horario,
      servico,
      preco_servico,
      concluido,
    } = req.body;

    /*
     * =====================================================
     * CORREÇÃO PRINCIPAL DO PROBLEMA
     * =====================================================
     *
     * Nunca fazemos:
     *
     * new Date(data)
     *
     * Nunca fazemos:
     *
     * data.toISOString()
     *
     * Nunca usamos:
     *
     * new Date(ano, mes - 1, dia)
     *
     * para montar a data que será salva.
     *
     * O valor YYYY-MM-DD é preservado literalmente.
     */

    let dataNormalizada;

    if (data !== undefined && data !== null && data !== "") {
      dataNormalizada = normalizarDataString(data);

      if (
        !dataNormalizada ||
        !validarDataYYYYMMDD(dataNormalizada)
      ) {
        return res.status(400).json({
          erro: "Data inválida. Use o formato YYYY-MM-DD.",
        });
      }
    } else {
      /*
       * Se o frontend não enviar uma nova data,
       * preservamos EXATAMENTE a data existente.
       */
      dataNormalizada = dataParaFrontend(agendamento.data);

      if (!dataNormalizada) {
        return res.status(500).json({
          erro: "Não foi possível determinar a data atual do agendamento.",
        });
      }
    }

    let horarioNormalizado;

    if (horario !== undefined && horario !== null && horario !== "") {
      horarioNormalizado = normalizarHorarioString(horario);

      if (!horarioNormalizado) {
        return res.status(400).json({
          erro: "Horário inválido. Use o formato HH:mm ou HH:mm:ss.",
        });
      }
    } else {
      horarioNormalizado = normalizarHorarioString(agendamento.horario);

      if (!horarioNormalizado) {
        return res.status(500).json({
          erro: "Não foi possível determinar o horário atual do agendamento.",
        });
      }
    }

    /*
     * Converte SOMENTE para o formato textual aceito pelo MySQL.
     *
     * Não existe conversão de timezone aqui.
     */
    const dataMySQL = dataParaMySQL(dataNormalizada);

    /*
     * Verificação de conflito.
     *
     * O DATE(data) garante que estamos comparando somente
     * o calendário, e não um instante UTC.
     */
    const conflito = await Agendamento.findOne({
      where: {
        id: {
          [Op.ne]: id,
        },
        [Op.and]: [
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("data")),
            dataNormalizada
          ),
          {
            horario: horarioNormalizado,
          },
        ],
      },
    });

    if (conflito) {
      return res.status(409).json({
        erro: "Já existe outro agendamento para esta data e horário.",
        agendamento: {
          id: conflito.id,
          nome_cliente: conflito.nome_cliente,
          data: dataParaFrontend(conflito.data),
          horario: normalizarHorarioString(conflito.horario),
        },
      });
    }

    /*
     * Montamos somente os campos que realmente foram enviados.
     *
     * Isso é importante porque alterar apenas o horário
     * NÃO deve reconstruir a data usando Date().
     */

    const dadosAtualizacao = {};

    if (nome_cliente !== undefined) {
      dadosAtualizacao.nome_cliente = nome_cliente;
    }

    if (telefone !== undefined) {
      dadosAtualizacao.telefone = telefone;
    }

    /*
     * A data sempre é gravada como string MySQL:
     *
     * YYYY-MM-DD 00:00:00
     */
    dadosAtualizacao.data = dataMySQL;

    dadosAtualizacao.horario = horarioNormalizado;

    if (servico !== undefined) {
      dadosAtualizacao.servico = servico;
    }

    if (preco_servico !== undefined) {
      dadosAtualizacao.preco_servico = Number(preco_servico);
    }

    if (concluido !== undefined) {
      dadosAtualizacao.concluido = Boolean(concluido);
    }

    console.log("ATUALIZANDO AGENDAMENTO:", {
      id,
      dataRecebida: data,
      dataAnterior: dataParaFrontend(agendamento.data),
      dataNormalizada,
      dataMySQL,
      horarioRecebido: horario,
      horarioNormalizado,
      dadosAtualizacao,
    });

    await agendamento.update(dadosAtualizacao);

    console.log("AGENDAMENTO ATUALIZADO:", {
      id,
      dadosAtualizacao: {
        ...dadosAtualizacao,
        data: dataNormalizada,
      },
    });

    /*
     * Recarrega o registro do banco para devolver exatamente
     * o que foi salvo.
     */
    await agendamento.reload();

    const json = agendamento.toJSON();

    return res.json({
      ...json,
      data: dataParaFrontend(json.data),
      horario: normalizarHorarioString(json.horario),
    });
  } catch (error) {
    console.error("Erro ao atualizar agendamento:", error);

    return res.status(500).json({
      erro: "Erro ao atualizar agendamento",
      detalhes: error.message,
    });
  }
});

/* =========================================================
   AGENDAMENTOS - PATCH
   ========================================================= */

app.patch("/agendamentos/:id", autenticar, async (req, res) => {
  try {
    const { id } = req.params;

    const agendamento = await Agendamento.findByPk(id);

    if (!agendamento) {
      return res.status(404).json({
        erro: "Agendamento não encontrado",
      });
    }

    const dados = req.body || {};

    /*
     * PATCH segue exatamente a mesma regra da PUT:
     * data nunca passa por conversão UTC.
     */

    const dadosAtualizacao = {};

    if (dados.nome_cliente !== undefined) {
      dadosAtualizacao.nome_cliente = dados.nome_cliente;
    }

    if (dados.telefone !== undefined) {
      dadosAtualizacao.telefone = dados.telefone;
    }

    if (dados.data !== undefined) {
      const dataNormalizada = normalizarDataString(dados.data);

      if (
        !dataNormalizada ||
        !validarDataYYYYMMDD(dataNormalizada)
      ) {
        return res.status(400).json({
          erro: "Data inválida. Use o formato YYYY-MM-DD.",
        });
      }

      dadosAtualizacao.data = dataParaMySQL(dataNormalizada);
    } else {
      /*
       * Mantém a data original.
       */
      dadosAtualizacao.data = dataParaMySQL(
        dataParaFrontend(agendamento.data)
      );
    }

    if (dados.horario !== undefined) {
      const horarioNormalizado = normalizarHorarioString(
        dados.horario
      );

      if (!horarioNormalizado) {
        return res.status(400).json({
          erro: "Horário inválido.",
        });
      }

      dadosAtualizacao.horario = horarioNormalizado;
    } else {
      dadosAtualizacao.horario = normalizarHorarioString(
        agendamento.horario
      );
    }

    if (dados.servico !== undefined) {
      dadosAtualizacao.servico = dados.servico;
    }

    if (dados.preco_servico !== undefined) {
      dadosAtualizacao.preco_servico = Number(
        dados.preco_servico
      );
    }

    if (dados.concluido !== undefined) {
      dadosAtualizacao.concluido = Boolean(dados.concluido);
    }

    const dataConflito = dataParaFrontend(
      dadosAtualizacao.data
    );

    const conflito = await Agendamento.findOne({
      where: {
        id: {
          [Op.ne]: id,
        },
        [Op.and]: [
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("data")),
            dataConflito
          ),
          {
            horario: dadosAtualizacao.horario,
          },
        ],
      },
    });

    if (conflito) {
      return res.status(409).json({
        erro: "Já existe outro agendamento para esta data e horário.",
        agendamento: {
          id: conflito.id,
          nome_cliente: conflito.nome_cliente,
          data: dataParaFrontend(conflito.data),
          horario: normalizarHorarioString(conflito.horario),
        },
      });
    }

    await agendamento.update(dadosAtualizacao);

    await agendamento.reload();

    const json = agendamento.toJSON();

    return res.json({
      ...json,
      data: dataParaFrontend(json.data),
      horario: normalizarHorarioString(json.horario),
    });
  } catch (error) {
    console.error("Erro no PATCH do agendamento:", error);

    return res.status(500).json({
      erro: "Erro ao atualizar agendamento",
      detalhes: error.message,
    });
  }
});

/* =========================================================
   AGENDAMENTOS - EXCLUIR
   ========================================================= */

app.delete("/agendamentos/:id", autenticar, async (req, res) => {
  try {
    const { id } = req.params;

    const agendamento = await Agendamento.findByPk(id);

    if (!agendamento) {
      return res.status(404).json({
        erro: "Agendamento não encontrado",
      });
    }

    await agendamento.destroy();

    return res.json({
      sucesso: true,
      mensagem: "Agendamento excluído com sucesso",
    });
  } catch (error) {
    console.error("Erro ao excluir agendamento:", error);

    return res.status(500).json({
      erro: "Erro ao excluir agendamento",
      detalhes: error.message,
    });
  }
});

/* =========================================================
   AGENDAMENTOS - CONCLUIR
   ========================================================= */

app.patch(
  "/agendamentos/:id/concluir",
  autenticar,
  async (req, res) => {
    try {
      const { id } = req.params;

      const agendamento = await Agendamento.findByPk(id);

      if (!agendamento) {
        return res.status(404).json({
          erro: "Agendamento não encontrado",
        });
      }

      await agendamento.update({
        concluido: true,
      });

      await agendamento.reload();

      const json = agendamento.toJSON();

      return res.json({
        ...json,
        data: dataParaFrontend(json.data),
        horario: normalizarHorarioString(json.horario),
      });
    } catch (error) {
      console.error("Erro ao concluir agendamento:", error);

      return res.status(500).json({
        erro: "Erro ao concluir agendamento",
        detalhes: error.message,
      });
    }
  }
);

/* =========================================================
   AGENDAMENTOS - DESCONCLUIR
   ========================================================= */

app.patch(
  "/agendamentos/:id/desconcluir",
  autenticar,
  async (req, res) => {
    try {
      const { id } = req.params;

      const agendamento = await Agendamento.findByPk(id);

      if (!agendamento) {
        return res.status(404).json({
          erro: "Agendamento não encontrado",
        });
      }

      await agendamento.update({
        concluido: false,
      });

      await agendamento.reload();

      const json = agendamento.toJSON();

      return res.json({
        ...json,
        data: dataParaFrontend(json.data),
        horario: normalizarHorarioString(json.horario),
      });
    } catch (error) {
      console.error(
        "Erro ao desconcluir agendamento:",
        error
      );

      return res.status(500).json({
        erro: "Erro ao desconcluir agendamento",
        detalhes: error.message,
      });
    }
  }
);

/* =========================================================
   ESTATÍSTICAS
   ========================================================= */

app.get("/estatisticas", autenticar, async (req, res) => {
  try {
    const total = await Agendamento.count();

    const hoje = new Date();

    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const dia = String(hoje.getDate()).padStart(2, "0");

    const hojeString = `${ano}-${mes}-${dia}`;

    const hojeCount = await Agendamento.count({
      where: sequelize.where(
        sequelize.fn("DATE", sequelize.col("data")),
        hojeString
      ),
    });

    const futuros = await Agendamento.count({
      where: sequelize.where(
        sequelize.fn("DATE", sequelize.col("data")),
        {
          [Op.gte]: hojeString,
        }
      ),
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

    const faturamentoHoje = await Agendamento.sum(
      "preco_servico",
      {
        where: {
          concluido: true,
          [Op.and]: [
            sequelize.where(
              sequelize.fn("DATE", sequelize.col("data")),
              hojeString
            ),
          ],
        },
      }
    );

    return res.json({
      total,
      hoje: hojeCount,
      futuros,
      cabelo,
      cabeloBarba,
      faturamentoHoje: faturamentoHoje || 0,
    });
  } catch (error) {
    console.error("Erro nas estatísticas:", error);

    return res.status(500).json({
      erro: "Erro ao carregar estatísticas",
      detalhes: error.message,
    });
  }
});

/* =========================================================
   ESTATÍSTICAS - PERÍODO
   ========================================================= */

app.get("/estatisticas/periodo", autenticar, async (req, res) => {
  try {
    const { inicio, fim } = req.query;

    if (!inicio || !fim) {
      return res.status(400).json({
        erro: "Informe inicio e fim no formato YYYY-MM-DD.",
      });
    }

    const inicioNormalizado = normalizarDataString(inicio);
    const fimNormalizado = normalizarDataString(fim);

    if (
      !inicioNormalizado ||
      !fimNormalizado ||
      !validarDataYYYYMMDD(inicioNormalizado) ||
      !validarDataYYYYMMDD(fimNormalizado)
    ) {
      return res.status(400).json({
        erro: "Período inválido.",
      });
    }

    const quantidade = await Agendamento.count({
      where: {
        [Op.and]: [
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("data")),
            {
              [Op.between]: [
                inicioNormalizado,
                fimNormalizado,
              ],
            }
          ),
        ],
      },
    });

    const faturamento = await Agendamento.sum(
      "preco_servico",
      {
        where: {
          concluido: true,
          [Op.and]: [
            sequelize.where(
              sequelize.fn("DATE", sequelize.col("data")),
              {
                [Op.between]: [
                  inicioNormalizado,
                  fimNormalizado,
                ],
              }
            ),
          ],
        },
      }
    );

    return res.json({
      inicio: inicioNormalizado,
      fim: fimNormalizado,
      quantidade,
      faturamento: faturamento || 0,
    });
  } catch (error) {
    console.error(
      "Erro nas estatísticas do período:",
      error
    );

    return res.status(500).json({
      erro: "Erro ao carregar estatísticas do período",
      detalhes: error.message,
    });
  }
});

/* =========================================================
   SERVIR ADMIN
   ========================================================= */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "..", "admin.html")
  );
});

/* =========================================================
   ERRO 404
   ========================================================= */

app.use((req, res) => {
  return res.status(404).json({
    erro: "Rota não encontrada",
    rota: req.method + " " + req.originalUrl,
  });
});

/* =========================================================
   TRATAMENTO GLOBAL DE ERROS
   ========================================================= */

app.use((error, req, res, next) => {
  console.error("ERRO GLOBAL:", error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({
    erro: "Erro interno do servidor",
    detalhes: error.message,
  });
});

/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

async function iniciarServidor() {
  try {
    await sequelize.authenticate();

    console.log("Banco de dados conectado.");
    console.log("Timezone configurado:", TIMEZONE);
    console.log(
      "Data/hora do servidor:",
      new Date().toString()
    );

    app.listen(PORT, "0.0.0.0", () => {
      console.log(
        `Servidor rodando na porta ${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "Não foi possível iniciar o servidor:",
      error
    );

    process.exit(1);
  }
}

iniciarServidor();

module.exports = app;