const path = require("path");

const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");

const { Boom } = require("@hapi/boom");
const qrcode = require("qrcode-terminal");
const Agendamento = require("../models/Agendamento");
const { Op } = require("sequelize");

// SEU NÚMERO DE TELEFONE COMPLETO COM CÓDIGO DO PAÍS E ÁREA, SEM O +
const adminNumbers = [
  "@s.whatsapp.net",
  "558192664901@s.whatsapp.net",
];

// Serviços disponíveis
const servicosDisponiveis = [
  {
    id: 1,
    nome: "Cabelo",
    preco: 30.0,
  },
  {
    id: 2,
    nome: "Barba",
    preco: 30.0,
  },
  {
    id: 3,
    nome: "Cabelo + Barba",
    preco: 45.0,
  },
  {
    id: 4,
    nome: "Sobrancelha",
    preco: 10.0,
  },
  {
    id: 5,
    nome: "Cabelo + Sobrancelha",
    preco: 35.0,
  },
  {
    id: 6,
    nome: "Cabelo + Barba + Sobrancelha",
    preco: 50.0,
  },
];

// Lista de horários disponíveis por dia
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

// Objeto para armazenar o estado de cada usuário
const estadosUsuarios = {};

function formatarPreco(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function numeroParaEmoji(numero) {
  const emojis = {
    0: "0️⃣",
    1: "1️⃣",
    2: "2️⃣",
    3: "3️⃣",
    4: "4️⃣",
    5: "5️⃣",
    6: "6️⃣",
    7: "7️⃣",
    8: "8️⃣",
    9: "9️⃣",
  };

  return numero
    .toString()
    .split("")
    .map((digito) => emojis[digito] || digito)
    .join("");
}

function montarMenuPrincipal(nome = "") {
  const saudacao = nome
    ? `💈 Olá, ${nome}! Bem-vindo à Barbearia Oficina do Homem. 💈`
    : "💈 Olá, somos a Barbearia Oficina do Homem! 💈";

  return (
    `${saudacao}\n` +
    "Escolha uma opção:\n\n" +
    "1️⃣ Ver horários\n" +
    "2️⃣ Agendar horário\n" +
    "3️⃣ Meus agendamentos\n" +
    "4️⃣ Cancelar agendamento"
  );
}

function montarMenuServicos() {
  let resposta = "💈 Escolha o tipo de serviço:\n\n";

  servicosDisponiveis.forEach((servico) => {
    resposta += `${numeroParaEmoji(servico.id)} ${servico.nome} - ${formatarPreco(
      servico.preco
    )}\n`;
  });

  resposta += "\nESCREVA 'VOLTAR' PARA RETORNAR AO MENU PRINCIPAL";

  return resposta;
}

function formatarHorarioParaBanco(horario) {
  if (!horario) return horario;

  if (/^\d{2}:\d{2}$/.test(horario)) {
    return `${horario}:00`;
  }

  return horario;
}

function formatarHorarioVisual(horario) {
  if (!horario) return "--:--";
  return horario.toString().slice(0, 5);
}

function formatarDataBrasileira(dataISO) {
  const data = new Date(dataISO);
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const ano = data.getFullYear();

  return `${dia}/${mes}/${ano}`;
}

function criarDataLocalPorDataAmericana(dataAmericana, horario = "00:00") {
  const [ano, mes, dia] = dataAmericana.split("-").map(Number);
  const [hora, minuto] = horario.split(":").map(Number);

  return new Date(ano, mes - 1, dia, hora, minuto, 0, 0);
}

// Função para obter os próximos 7 dias úteis da barbearia
// Segunda a sábado, sem domingo
function obterProximosDias() {
  const dias = [
    "domingo",
    "segunda",
    "terca",
    "quarta",
    "quinta",
    "sexta",
    "sabado",
  ];

  const nomesBonitos = {
    domingo: "domingo",
    segunda: "segunda",
    terca: "terça",
    quarta: "quarta",
    quinta: "quinta",
    sexta: "sexta",
    sabado: "sábado",
  };

  const datas = [];
  const hoje = new Date();

  let i = 0;

  while (datas.length < 7) {
    const data = new Date(hoje.getTime());
    data.setDate(hoje.getDate() + i);

    const diaSemana = dias[data.getDay()];

    // Ignora domingo
    if (diaSemana !== "domingo") {
      const dia = String(data.getDate()).padStart(2, "0");
      const mes = String(data.getMonth() + 1).padStart(2, "0");
      const ano = data.getFullYear();

      datas.push({
        diaSemana,
        diaSemanaNome: nomesBonitos[diaSemana],
        dataFormatada: `${dia}/${mes}/${ano}`,
        dataAmericana: `${ano}-${mes}-${dia}`,
      });
    }

    i++;
  }

  return datas;
}

function montarMenuDatas() {
  const datasDisponiveis = obterProximosDias();

  let resposta = "📅 Escolha uma data para o agendamento:\n";

  datasDisponiveis.forEach((data, index) => {
    const numeroFormatado = numeroParaEmoji(index + 1);
    resposta += `${numeroFormatado} ${data.diaSemanaNome} (${data.dataFormatada})\n`;
  });

  resposta += "\nESCREVA 'VOLTAR' PARA RETORNAR AO MENU PRINCIPAL";

  return resposta;
}

async function obterHorariosDisponiveis(dataEscolhida) {
  const horariosDoDia = horariosPorDia[dataEscolhida.diaSemana] || [];

  if (horariosDoDia.length === 0) {
    return [];
  }

  const inicioDia = criarDataLocalPorDataAmericana(
    dataEscolhida.dataAmericana,
    "00:00"
  );

  const fimDia = criarDataLocalPorDataAmericana(
    dataEscolhida.dataAmericana,
    "23:59"
  );

  const agendamentosDoDia = await Agendamento.findAll({
    where: {
      data: {
        [Op.between]: [inicioDia, fimDia],
      },
    },
    attributes: ["horario"],
  });

  const horariosAgendados = agendamentosDoDia.map((agendamento) =>
    formatarHorarioVisual(agendamento.horario)
  );

  const agora = new Date();

  const horariosDisponiveis = horariosDoDia.filter((horario) => {
    const horarioEstaAgendado = horariosAgendados.includes(horario);

    if (horarioEstaAgendado) {
      return false;
    }

    const dataHorario = criarDataLocalPorDataAmericana(
      dataEscolhida.dataAmericana,
      horario
    );

    const horarioJaPassou = dataHorario <= agora;

    if (horarioJaPassou) {
      return false;
    }

    return true;
  });

  return horariosDisponiveis;
}

// Função para criar um agendamento
async function criarAgendamento(
  nome,
  telefone,
  dataBrasileira,
  horario,
  servico,
  precoServico
) {
  try {
    const [dia, mes, ano] = dataBrasileira.split("/");
    const dataSomente = new Date(`${ano}-${mes}-${dia}T00:00:00`);

    const horarioFormatado = formatarHorarioParaBanco(horario);

    const agendamentoExistente = await Agendamento.findOne({
      where: {
        data: dataSomente,
        horario: horarioFormatado,
      },
    });

    if (agendamentoExistente) {
      throw new Error("Horário já agendado para esta data.");
    }

    const agendamento = await Agendamento.create({
      nome_cliente: nome,
      telefone,
      data: dataSomente,
      horario: horarioFormatado,
      servico,
      preco_servico: precoServico || 0,
    });

    console.log("Agendamento criado com sucesso:", agendamento);
    return agendamento;
  } catch (error) {
    throw new Error("Erro ao criar agendamento: " + error.message);
  }
}

// Função para listar agendamentos de um cliente específico
async function listarAgendamentos(telefoneCliente) {
  try {
    const agendamentos = await Agendamento.findAll({
      where: { telefone: telefoneCliente },
      order: [
        ["data", "ASC"],
        ["horario", "ASC"],
      ],
      attributes: [
        "id",
        "nome_cliente",
        "data",
        "horario",
        "servico",
        "preco_servico",
      ],
    });

    if (!agendamentos || agendamentos.length === 0) {
      return "📅 Você não possui agendamentos.";
    }

    let resposta = "📅 *Seus agendamentos:*\n\n";

    agendamentos.forEach((agendamento, index) => {
      let dataFormatada = "Data inválida";
      const horarioFormatado = formatarHorarioVisual(agendamento.horario);

      if (typeof agendamento.data === "string") {
        const [dataParte] = agendamento.data.split(" ");
        const [ano, mes, dia] = dataParte.split("-");
        dataFormatada = `${dia}/${mes}/${ano}`;
      } else if (agendamento.data instanceof Date) {
        dataFormatada = formatarDataBrasileira(agendamento.data);
      }

      const numeroFormatado = numeroParaEmoji(index + 1);

      resposta +=
        `${numeroFormatado} *${agendamento.nome_cliente}*\n` +
        `📅 Data: ${dataFormatada}\n` +
        `⏰ Horário: ${horarioFormatado}\n` +
        `✂️ Serviço: ${agendamento.servico || "Não especificado"}\n` +
        `💰 Valor: ${formatarPreco(agendamento.preco_servico || 0)}\n\n`;
    });

    return resposta;
  } catch (error) {
    console.error("Erro ao carregar agendamentos:", error);

    return "❌ Ocorreu um erro ao carregar seus agendamentos. Por favor, tente novamente mais tarde.";
  }
}

// Função para cancelar um agendamento
async function cancelarAgendamento(telefoneCliente, indice) {
  try {
    const agendamentos = await Agendamento.findAll({
      where: { telefone: telefoneCliente },
      order: [
        ["data", "ASC"],
        ["horario", "ASC"],
      ],
    });

    if (indice < 1 || indice > agendamentos.length) {
      throw new Error("Índice inválido.");
    }

    const agendamentoCancelado = agendamentos[indice - 1];

    await Agendamento.destroy({
      where: { id: agendamentoCancelado.id },
    });

    console.log("Agendamento cancelado:", agendamentoCancelado);

    return agendamentoCancelado;
  } catch (error) {
    throw new Error("Erro ao cancelar agendamento: " + error.message);
  }
}

// Função para listar os agendamentos do dia
async function listarAgendamentosDoDia() {
  try {
    const hoje = new Date();

    const inicioDoDia = new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      hoje.getDate(),
      0,
      0,
      0,
      0
    );

    const fimDoDia = new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      hoje.getDate(),
      23,
      59,
      59,
      999
    );

    const agendamentos = await Agendamento.findAll({
      where: {
        data: {
          [Op.between]: [inicioDoDia, fimDoDia],
        },
      },
      order: [["horario", "ASC"]],
    });

    if (!agendamentos.length) {
      return "📅 Nenhum agendamento para hoje.";
    }

    let resposta = "📅 *Agendamentos para hoje:*\n\n";

    agendamentos.forEach((ag, index) => {
      const numero = numeroParaEmoji(index + 1);
      const horario = formatarHorarioVisual(ag.horario);

      resposta += `${numero} *${ag.nome_cliente}*\n`;
      resposta += `⏰ Horário: ${horario}\n`;
      resposta += `✂️ Serviço: ${ag.servico || "Não especificado"}\n`;
      resposta += `💰 Valor: ${formatarPreco(ag.preco_servico || 0)}\n\n`;
    });

    return resposta;
  } catch (error) {
    console.error("Erro ao listar agendamentos do dia:", error);

    return "❌ Ocorreu um erro ao buscar os agendamentos de hoje.";
  }
}

async function handleAdminCommands(sock, sender, text) {
  if (!adminNumbers.includes(sender)) return;

  const formatarAgendamento = (a) =>
    `📌 *ID:* ${a.id}\n` +
    `👤 *Cliente:* ${a.nome_cliente}\n` +
    `📅 *Data:* ${formatarDataBrasileira(a.data)}\n` +
    `⏰ *Hora:* ${formatarHorarioVisual(a.horario)}\n` +
    `✂️ *Serviço:* ${a.servico || "Não especificado"}\n` +
    `💰 *Valor:* ${formatarPreco(a.preco_servico || 0)}`;

  const enviarAgendamentos = async (destinatario, titulo, agendamentos) => {
    if (agendamentos.length === 0) {
      await sock.sendMessage(destinatario, {
        text: "📭 Nenhum agendamento encontrado.",
      });
    } else {
      const resposta = agendamentos.map(formatarAgendamento).join("\n\n");

      await sock.sendMessage(destinatario, {
        text: `${titulo}\n\n${resposta}`,
      });
    }
  };

  if (text === "!admin") {
    await sock.sendMessage(sender, {
      text:
        `👑 *Menu do Administrador:*\n\n` +
        `1️⃣ Ver agendamentos de hoje\n` +
        `2️⃣ Ver agendamentos da semana\n` +
        `3️⃣ Cancelar agendamento por ID\n` +
        `4️⃣ Ver agendamentos por data\n` +
        `5️⃣ Editar horário do agendamento\n` +
        `6️⃣ Ver todos os agendamentos futuros\n` +
        `7️⃣ Voltar\n\n` +
        `Comandos diretos:\n` +
        `• *!cancelar 123*\n` +
        `• *!data 25/04/2026*\n` +
        `• *!editar 123 14:00*`,
    });
    return;
  }

  switch (true) {
    case text === "1": {
      const hoje = new Date();

      const inicio = new Date(
        hoje.getFullYear(),
        hoje.getMonth(),
        hoje.getDate(),
        0,
        0,
        0,
        0
      );

      const fim = new Date(
        hoje.getFullYear(),
        hoje.getMonth(),
        hoje.getDate(),
        23,
        59,
        59,
        999
      );

      const agendamentosHoje = await Agendamento.findAll({
        where: {
          data: {
            [Op.between]: [inicio, fim],
          },
        },
        order: [
          ["data", "ASC"],
          ["horario", "ASC"],
        ],
      });

      await enviarAgendamentos(
        sender,
        "📅 *Agendamentos de hoje:*",
        agendamentosHoje
      );
      break;
    }

    case text === "2": {
      const hoje = new Date();

      const inicio = new Date(
        hoje.getFullYear(),
        hoje.getMonth(),
        hoje.getDate(),
        0,
        0,
        0,
        0
      );

      const fimSemana = new Date(inicio);
      fimSemana.setDate(inicio.getDate() + 7);
      fimSemana.setHours(23, 59, 59, 999);

      const agendamentosSemana = await Agendamento.findAll({
        where: {
          data: {
            [Op.between]: [inicio, fimSemana],
          },
        },
        order: [
          ["data", "ASC"],
          ["horario", "ASC"],
        ],
      });

      await enviarAgendamentos(
        sender,
        "📆 *Agendamentos da semana:*",
        agendamentosSemana
      );
      break;
    }

    case text === "3": {
      await sock.sendMessage(sender, {
        text: "📌 Para cancelar, envie: *!cancelar ID*.\nExemplo: *!cancelar 123*",
      });
      break;
    }

    case /^!cancelar\s+\d+$/.test(text): {
      const id = parseInt(text.split(" ")[1]);
      const agendamento = await Agendamento.findByPk(id);

      if (!agendamento) {
        await sock.sendMessage(sender, {
          text: "❌ Agendamento não encontrado.",
        });
      } else {
        await agendamento.destroy();

        await sock.sendMessage(sender, {
          text: `✅ Agendamento com *ID ${id}* foi cancelado.`,
        });
      }
      break;
    }

    case text === "4": {
      await sock.sendMessage(sender, {
        text: "📅 Para buscar agendamentos por data, envie: *!data DD/MM/AAAA*.\nExemplo: *!data 25/04/2026*",
      });
      break;
    }

    case /^!data\s+\d{2}\/\d{2}\/\d{4}$/.test(text): {
      const dataBr = text.split(" ")[1];
      const [dia, mes, ano] = dataBr.split("/");

      const inicio = new Date(`${ano}-${mes}-${dia}T00:00:00`);
      const fim = new Date(`${ano}-${mes}-${dia}T23:59:59`);

      const agendamentos = await Agendamento.findAll({
        where: {
          data: {
            [Op.between]: [inicio, fim],
          },
        },
        order: [
          ["data", "ASC"],
          ["horario", "ASC"],
        ],
      });

      await enviarAgendamentos(
        sender,
        `📅 *Agendamentos para ${dataBr}:*`,
        agendamentos
      );
      break;
    }

    case text === "5": {
      await sock.sendMessage(sender, {
        text: "✏️ Para editar, envie: *!editar ID HH:MM*.\nExemplo: *!editar 123 14:00*",
      });
      break;
    }

    case /^!editar\s+\d+\s+\d{2}:\d{2}(:\d{2})?$/.test(text): {
      const [, idStr, novoHorario] = text.split(" ");
      const id = parseInt(idStr);
      const agendamento = await Agendamento.findByPk(id);

      if (!agendamento) {
        await sock.sendMessage(sender, {
          text: "❌ Agendamento não encontrado.",
        });
      } else {
        agendamento.horario = formatarHorarioParaBanco(novoHorario);
        await agendamento.save();

        await sock.sendMessage(sender, {
          text: `✏️ Agendamento com ID *${id}* atualizado para *${formatarHorarioVisual(
            novoHorario
          )}*.`,
        });
      }
      break;
    }

    case text === "6": {
      const hoje = new Date();

      const inicio = new Date(
        hoje.getFullYear(),
        hoje.getMonth(),
        hoje.getDate(),
        0,
        0,
        0,
        0
      );

      const agendamentosFuturos = await Agendamento.findAll({
        where: {
          data: {
            [Op.gte]: inicio,
          },
        },
        order: [
          ["data", "ASC"],
          ["horario", "ASC"],
        ],
      });

      await enviarAgendamentos(
        sender,
        "📅 *Todos os agendamentos futuros:*",
        agendamentosFuturos
      );
      break;
    }

    case text === "7": {
      await sock.sendMessage(sender, {
        text: "🔙 Voltando ao menu principal...",
      });
      break;
    }

    default:
      await sock.sendMessage(sender, {
        text: "❓ Comando inválido. Envie *!admin* para ver o menu.",
      });
  }
}

// Função principal para processar mensagens de cliente
async function processarMensagemCliente(sock, sender, text) {
  const estadoUsuario = estadosUsuarios[sender] || {
    etapa: "solicitando_nome",
  };

  if (text === "voltar") {
    estadosUsuarios[sender] = {
      ...estadoUsuario,
      etapa: "menu",
    };

    await sock.sendMessage(sender, {
      text: montarMenuPrincipal(estadoUsuario.nome),
    });

    return;
  }

  if (estadoUsuario.etapa === "solicitando_nome") {
    if (!estadoUsuario.nomeSolicitado) {
      await sock.sendMessage(sender, {
        text: "💈 OLÁ, SOMOS A BARBEARIA OFICINA DO HOMEM! INFORME SEU NOME: 💈",
      });

      estadoUsuario.nomeSolicitado = true;
      estadosUsuarios[sender] = estadoUsuario;

      return;
    }

    if (estadoUsuario.nomeSolicitado && text) {
      estadoUsuario.nome = text;
      estadoUsuario.nomeSolicitado = false;
      estadoUsuario.etapa = "menu";

      estadosUsuarios[sender] = estadoUsuario;

      await sock.sendMessage(sender, {
        text: montarMenuPrincipal(estadoUsuario.nome),
      });

      return;
    }
  }

  if (estadoUsuario.etapa === "menu") {
    if (
      text.includes("1") ||
      text.includes("horários") ||
      text.includes("horarios")
    ) {
      await sock.sendMessage(sender, {
        text:
          "💈 Segunda à sexta das 8h às 19:00! 💈\n" +
          "💈 Aos sábados das 8h às 18:00! 💈\n\n" +
          "ESCREVA 'VOLTAR' PARA RETORNAR AO MENU PRINCIPAL",
      });

      return;
    }

    if (text.includes("2") || text.includes("agendar")) {
      await sock.sendMessage(sender, {
        text: montarMenuServicos(),
      });

      estadosUsuarios[sender] = {
        ...estadoUsuario,
        etapa: "escolhendo_servico",
      };

      return;
    }

    if (text.includes("3") || text.includes("agendamentos")) {
      const agendamentos = await listarAgendamentos(sender);

      await sock.sendMessage(sender, {
        text: agendamentos,
      });

      return;
    }

    if (text.includes("4") || text.includes("cancelar")) {
      const agendamentos = await listarAgendamentos(sender);

      await sock.sendMessage(sender, {
        text:
          `${agendamentos}\n\n` +
          "🔹 Escolha o número do agendamento que deseja cancelar.\n\n" +
          "🔹 ESCREVA 'VOLTAR' PARA RETORNAR AO MENU PRINCIPAL",
      });

      estadosUsuarios[sender] = {
        ...estadoUsuario,
        etapa: "cancelando_agendamento",
      };

      return;
    }

    await sock.sendMessage(sender, {
      text: montarMenuPrincipal(estadoUsuario.nome),
    });

    return;
  }

  if (estadoUsuario.etapa === "escolhendo_servico") {
    const opcaoServico = parseInt(text);

    const servicoEscolhido = servicosDisponiveis.find(
      (servico) => servico.id === opcaoServico
    );

    if (!servicoEscolhido) {
      await sock.sendMessage(sender, {
        text: `❌ Opção inválida.\n\n${montarMenuServicos()}`,
      });

      return;
    }

    estadoUsuario.servico = servicoEscolhido.nome;
    estadoUsuario.precoServico = servicoEscolhido.preco;

    estadosUsuarios[sender] = {
      ...estadoUsuario,
      etapa: "escolhendo_data",
    };

    await sock.sendMessage(sender, {
      text:
        `✅ Serviço escolhido: *${servicoEscolhido.nome}*\n` +
        `💰 Valor: *${formatarPreco(servicoEscolhido.preco)}*\n\n` +
        montarMenuDatas(),
    });

    return;
  }

  if (estadoUsuario.etapa === "escolhendo_data") {
    if (!text.match(/^[1-7]$/)) {
      await sock.sendMessage(sender, {
        text: "❌ Opção inválida. Por favor, escolha um número da lista de datas.",
      });

      return;
    }

    const escolhaIndex = parseInt(text) - 1;
    const datasDisponiveis = obterProximosDias();
    const dataEscolhida = datasDisponiveis[escolhaIndex];

    if (!dataEscolhida) {
      await sock.sendMessage(sender, {
        text: "❌ Data inválida. Por favor, escolha um número da lista de datas.",
      });

      return;
    }

    const horariosDisponiveis = await obterHorariosDisponiveis(dataEscolhida);

    if (horariosDisponiveis.length === 0) {
      await sock.sendMessage(sender, {
        text:
          `❌ Não há horários disponíveis para ${dataEscolhida.diaSemanaNome} ` +
          `(${dataEscolhida.dataFormatada}).\n\n` +
          `Por favor, escolha outra data.\n\n` +
          montarMenuDatas(),
      });

      return;
    }

    let resposta = `⏳ Escolha um horário disponível para ${dataEscolhida.diaSemanaNome} (${dataEscolhida.dataFormatada}):\n`;

    horariosDisponiveis.forEach((horario, index) => {
      const numeroFormatado = numeroParaEmoji(index + 1);
      resposta += `${numeroFormatado} ${horario}\n`;
    });

    resposta += "\nESCREVA 'VOLTAR' PARA RETORNAR AO MENU PRINCIPAL";

    await sock.sendMessage(sender, {
      text: resposta,
    });

    estadosUsuarios[sender] = {
      ...estadoUsuario,
      etapa: "escolhendo_horario",
      dataEscolhida,
      horariosDisponiveis,
    };

    return;
  }

  if (estadoUsuario.etapa === "escolhendo_horario") {
    if (!text.match(/^\d+$/)) {
      await sock.sendMessage(sender, {
        text: "❌ Opção inválida. Por favor, escolha um número da lista de horários.",
      });

      return;
    }

    const escolhaIndex = parseInt(text) - 1;
    const horariosDisponiveis = estadoUsuario.horariosDisponiveis || [];

    if (escolhaIndex < 0 || escolhaIndex >= horariosDisponiveis.length) {
      await sock.sendMessage(sender, {
        text: "❌ Opção inválida. Por favor, escolha um número da lista de horários disponíveis.",
      });

      return;
    }

    const horarioEscolhido = horariosDisponiveis[escolhaIndex];

    try {
      await criarAgendamento(
        estadoUsuario.nome || "Cliente",
        sender,
        estadoUsuario.dataEscolhida.dataFormatada,
        horarioEscolhido,
        estadoUsuario.servico,
        estadoUsuario.precoServico
      );

      await sock.sendMessage(sender, {
        text:
          `✅ Seu horário foi agendado com sucesso!\n\n` +
          `👤 Cliente: *${estadoUsuario.nome || "Cliente"}*\n` +
          `✂️ Serviço: *${estadoUsuario.servico}*\n` +
          `💰 Valor: *${formatarPreco(estadoUsuario.precoServico)}*\n` +
          `📅 Data: *${estadoUsuario.dataEscolhida.diaSemanaNome} (${estadoUsuario.dataEscolhida.dataFormatada})*\n` +
          `⏰ Horário: *${horarioEscolhido}*\n\n` +
          `ESCREVA "VOLTAR" PARA RETORNAR AO MENU PRINCIPAL`,
      });

      estadosUsuarios[sender] = {
        ...estadoUsuario,
        etapa: "menu",
        horariosDisponiveis: [],
      };
    } catch (error) {
      await sock.sendMessage(sender, {
        text: `❌ ${error.message}`,
      });
    }

    return;
  }

  if (estadoUsuario.etapa === "cancelando_agendamento") {
    if (!text.match(/^\d+$/)) {
      await sock.sendMessage(sender, {
        text: "❌ Opção inválida. Por favor, escolha um número da lista de agendamentos.",
      });

      return;
    }

    const indice = parseInt(text);

    try {
      const agendamentoCancelado = await cancelarAgendamento(sender, indice);

      const dataCancelada =
        agendamentoCancelado.data instanceof Date
          ? formatarDataBrasileira(agendamentoCancelado.data)
          : new Date(agendamentoCancelado.data).toLocaleDateString("pt-BR");

      await sock.sendMessage(sender, {
        text:
          `✅ Agendamento cancelado com sucesso.\n\n` +
          `📅 Data: ${dataCancelada}\n` +
          `⏰ Horário: ${formatarHorarioVisual(agendamentoCancelado.horario)}\n` +
          `✂️ Serviço: ${agendamentoCancelado.servico || "Não especificado"}\n` +
          `💰 Valor: ${formatarPreco(agendamentoCancelado.preco_servico || 0)}\n\n` +
          `ESCREVA "VOLTAR" PARA RETORNAR AO MENU PRINCIPAL`,
      });

      estadosUsuarios[sender] = {
        ...estadoUsuario,
        etapa: "menu",
      };
    } catch (error) {
      await sock.sendMessage(sender, {
        text: `❌ ${error.message}`,
      });
    }

    return;
  }
}

// Função para inicializar o bot
async function startBot() {
  const authPath = path.join(__dirname, "../baileys_auth_info");

  const { state, saveCreds } = await useMultiFileAuthState(authPath);

const sock = makeWASocket({
  auth: state,
  browser: ["Ubuntu", "Chrome", "120.0.0"],
  markOnlineOnConnect: false,
  syncFullHistory: false,
});
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    console.log("Atualização de conexão:", update);

    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("📲 Escaneie o QR Code abaixo com o WhatsApp:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const reason = lastDisconnect?.error;

      console.log("Motivo da desconexão:", reason);

      if (
        reason instanceof Boom &&
        reason.output?.statusCode === DisconnectReason.loggedOut
      ) {
        console.log(
          "Você foi desconectado. Apague a sessão antiga e escaneie o QR Code novamente."
        );

        return;
      }

      console.log("Conexão perdida. Tentando reconectar em 5 segundos...");

      setTimeout(startBot, 5000);
    } else if (connection === "open") {
      console.log("🤖 Bot conectado ao WhatsApp!");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    let sender = null;

    try {
      const msg = messages[0];

      if (!msg.message || msg.key.fromMe) return;

      sender = msg.key.remoteJid;

      const text = (
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        ""
      )
        .toLowerCase()
        .trim();

      if (!text) return;

      console.log("Texto da mensagem:", text, "De:", sender);

      if (sender === adminNumbers[0] && text === "!agendamentos") {
        const listaDeAgendamentos = await listarAgendamentosDoDia();

        await sock.sendMessage(sender, {
          text: listaDeAgendamentos,
        });

        return;
      }

      if (adminNumbers.includes(sender)) {
        await handleAdminCommands(sock, sender, text);
        return;
      }

      await processarMensagemCliente(sock, sender, text);
    } catch (error) {
      console.error("Erro ao processar mensagem:", error);

      if (sender) {
        await sock.sendMessage(sender, {
          text: "❌ Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde.",
        });
      }
    }
  });

  return sock;
}

if (require.main === module) {
  startBot();
}

module.exports = {
  startBot,
  handleAdminCommands,
  processarMensagemCliente,
  horariosPorDia,
  estadosUsuarios,
  numeroParaEmoji,
  obterProximosDias,
  obterHorariosDisponiveis,
  criarAgendamento,
  listarAgendamentos,
  cancelarAgendamento,
  listarAgendamentosDoDia,
  servicosDisponiveis,
  formatarPreco,
  montarMenuServicos,
  montarMenuPrincipal,
};