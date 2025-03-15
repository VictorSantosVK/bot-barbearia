const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const fs = require("fs");
const path = require("path");
const emoji = require("node-emoji");

// Caminho para o arquivo agendamentos.json
const agendamentosPath = path.join(__dirname, "agendamentos.json");

// Lista de horários disponíveis por dia
const horariosPorDia = {
  "segunda": ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"],
  "terca": ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"],
  "quarta": ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"],
  "quinta": ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"],
  "sexta": ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"],
  "sabado": ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"],
  "domingo": [] // Sem horários disponíveis
};

// Verificar se o arquivo existe. Se não existir, criá-lo.
if (!fs.existsSync(agendamentosPath)) {
  fs.writeFileSync(agendamentosPath, JSON.stringify([]));
}

// Objeto para armazenar o estado de cada usuário
const estadosUsuarios = {};

// Função para converter números em emojis
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

  // Converte o número em uma string e mapeia cada dígito para o emoji correspondente
  return numero
    .toString()
    .split("")
    .map((digito) => emojis[digito] || digito)
    .join("");
}

// Função para obter os próximos 7 dias
function obterProximosDias() {
  const dias = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
  const datas = [];
  const hoje = new Date();

  for (let i = 0; i < 7; i++) {
    const data = new Date(hoje);
    data.setDate(hoje.getDate() + i);
    const diaSemana = dias[data.getDay()];
    const dataFormatada = data.toLocaleDateString("pt-BR"); // Formato: DD/MM/AAAA
    datas.push({ diaSemana, dataFormatada });
  }

  return datas;
}

// Função para criar um agendamento
async function criarAgendamento(nome, telefone, data, horario, servico) {
  const agendamentos = JSON.parse(fs.readFileSync(agendamentosPath, "utf-8")) || [];

  // Verificar se o horário já está agendado para a data escolhida
  const horarioOcupado = agendamentos.some(
    (a) => a.data === data && a.horario === horario
  );

  if (horarioOcupado) {
    throw new Error("Horário já agendado para esta data.");
  }

  const agendamento = { nome, telefone, data, horario, servico };
  agendamentos.push(agendamento);
  fs.writeFileSync(agendamentosPath, JSON.stringify(agendamentos, null, 2));
  console.log("Agendamento criado:", agendamento);
}

// Função para listar agendamentos de um cliente específico
async function listarAgendamentos(telefoneCliente) {
  if (!fs.existsSync(agendamentosPath)) {
    fs.writeFileSync(agendamentosPath, JSON.stringify([]));
  }

  try {
    const agendamentos = JSON.parse(fs.readFileSync(agendamentosPath, "utf-8")) || [];

    // Filtrar agendamentos pelo número de telefone do cliente e garantir que a data e horário sejam válidos
    const agendamentosCliente = agendamentos.filter(
      (a) => a.telefone === telefoneCliente && a.data && a.horario
    );

    if (agendamentosCliente.length === 0) {
      return "📅 Você não possui agendamentos.";
    }

    let resposta = "📅 *Seus agendamentos:*\n";
    agendamentosCliente.forEach((a, index) => {
      const numeroFormatado = numeroParaEmoji(index + 1); // Converte o número para emoji
      resposta += `${numeroFormatado} ${a.nome || "Cliente"} - ${a.data} às ${a.horario}\n`;
    });

    return resposta;
  } catch (error) {
    console.error("Erro ao carregar agendamentos:", error);
    return "❌ Erro ao carregar os agendamentos.";
  }
}

// Função para cancelar um agendamento
async function cancelarAgendamento(telefoneCliente, indice) {
  const agendamentos = JSON.parse(fs.readFileSync(agendamentosPath, "utf-8")) || [];

  // Filtrar agendamentos pelo número de telefone do cliente
  const agendamentosCliente = agendamentos.filter((a) => a.telefone === telefoneCliente);

  if (indice < 1 || indice > agendamentosCliente.length) {
    throw new Error("Índice inválido.");
  }

  // Remover o agendamento escolhido
  const agendamentoCancelado = agendamentosCliente[indice - 1];
  const novosAgendamentos = agendamentos.filter((a) => a !== agendamentoCancelado);

  // Salvar os agendamentos atualizados
  fs.writeFileSync(agendamentosPath, JSON.stringify(novosAgendamentos, null, 2));
  console.log("Agendamento cancelado:", agendamentoCancelado);

  return agendamentoCancelado;
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("baileys_auth_info");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    console.log("Atualização de conexão:", update);

    if (update.connection === "close") {
      const reason = update.lastDisconnect?.error;
      console.log("Motivo da desconexão:", reason);

      if (
        reason instanceof Boom &&
        reason.output?.statusCode === DisconnectReason.loggedOut
      ) {
        console.log(
          "Você foi desconectado. Por favor, escaneie o QR Code novamente."
        );
        return;
      }

      console.log("Conexão perdida. Tentando reconectar em 5 segundos...");
      setTimeout(startBot, 5000);
    } else if (update.connection === "open") {
      console.log("🤖 Bot conectado ao WhatsApp!");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const text = (
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      ""
    )
      .toLowerCase()
      .trim();

    console.log("Texto da mensagem:", text);

    // Verificar o estado atual do usuário
    const estadoUsuario = estadosUsuarios[sender] || { etapa: "menu" };

    if (estadoUsuario.etapa === "menu") {
      if (text.includes("1") || text.includes("horários")) {
        console.log("Opção 1 selecionada: Ver horários");
        await sock.sendMessage(sender, { text: "Temos horários das 8h às 18h30!" });
        return;
      } else if (text.includes("2") || text.includes("agendar")) {
        console.log("Opção 2 selecionada: Agendar horário");
        const datasDisponiveis = obterProximosDias();
        let resposta = "📅 Escolha uma data para o agendamento:\n";
        datasDisponiveis.forEach((data, index) => {
          const numeroFormatado = numeroParaEmoji(index + 1); // Converte o número para emoji
          resposta += `${numeroFormatado} ${data.diaSemana} (${data.dataFormatada})\n`;
        });
        await sock.sendMessage(sender, { text: resposta });
        estadosUsuarios[sender] = { etapa: "escolhendo_data" }; // Atualiza o estado
        return;
      } else if (text.includes("3") || text.includes("agendamentos")) {
        console.log("Opção 3 selecionada: Ver agendamentos");
        const agendamentos = await listarAgendamentos(sender); // Filtra por cliente
        await sock.sendMessage(sender, { text: agendamentos });
        return;
      } else if (text.includes("4") || text.includes("cancelar")) {
        console.log("Opção 4 selecionada: Cancelar agendamento");
        const agendamentos = await listarAgendamentos(sender); // Filtra por cliente
        await sock.sendMessage(sender, {
          text: `${agendamentos}\n\n🔹 Escolha o número do agendamento que deseja cancelar:`,
        });
        estadosUsuarios[sender] = { etapa: "cancelando_agendamento" }; // Atualiza o estado
        return;
      } else {
        console.log("Nenhuma opção válida selecionada. Exibindo menu.");
        await sock.sendMessage(sender, {
          text: "Olá! Escolha:\n1️⃣ Ver horários\n2️⃣ Agendar horário\n3️⃣ Meus agendamentos\n4️⃣ Cancelar agendamento",
        });
        return;
      }
    } else if (estadoUsuario.etapa === "escolhendo_data") {
      if (text.match(/^[1-7]$/)) {
        const escolhaIndex = parseInt(text) - 1;
        const datasDisponiveis = obterProximosDias();
        const dataEscolhida = datasDisponiveis[escolhaIndex];

        if (dataEscolhida) {
          const horariosDisponiveis = horariosPorDia[dataEscolhida.diaSemana] || [];
          if (horariosDisponiveis.length === 0) {
            await sock.sendMessage(sender, {
              text: `❌ Não há horários disponíveis para ${dataEscolhida.diaSemana} (${dataEscolhida.dataFormatada}).`,
            });
            estadosUsuarios[sender] = { etapa: "menu" }; // Volta ao menu
            return;
          }

          let resposta = `⏳ Escolha um horário disponível para ${dataEscolhida.diaSemana} (${dataEscolhida.dataFormatada}):\n`;
          horariosDisponiveis.forEach((horario, index) => {
            const numeroFormatado = numeroParaEmoji(index + 1); // Converte o número para emoji
            resposta += `${numeroFormatado} ${horario}\n`;
          });

          await sock.sendMessage(sender, { text: resposta });
          estadosUsuarios[sender] = { etapa: "escolhendo_horario", dataEscolhida }; // Atualiza o estado
        } else {
          await sock.sendMessage(sender, {
            text: "❌ Data inválida. Por favor, escolha um número da lista de datas.",
          });
        }
      } else {
        await sock.sendMessage(sender, {
          text: "❌ Opção inválida. Por favor, escolha um número da lista de datas.",
        });
      }
      return;
    } else if (estadoUsuario.etapa === "escolhendo_horario") {
      if (text.match(/^\d+$/)) { // Permite números com mais de um dígito
        const escolhaIndex = parseInt(text) - 1; // Converte para índice (começa em 0)
        const horariosDisponiveis = horariosPorDia[estadoUsuario.dataEscolhida.diaSemana] || [];

        if (escolhaIndex >= 0 && escolhaIndex < horariosDisponiveis.length) {
          const horarioEscolhido = horariosDisponiveis[escolhaIndex];

          try {
            await criarAgendamento(
              "Cliente", // Substitua pelo nome real do cliente
              sender,
              estadoUsuario.dataEscolhida.dataFormatada, // Passa a data corretamente
              horarioEscolhido, // Passa o horário corretamente
              "Corte Agendado"
            );
            await sock.sendMessage(sender, {
              text: `✅ Seu horário foi agendado com sucesso para ${estadoUsuario.dataEscolhida.diaSemana} (${estadoUsuario.dataEscolhida.dataFormatada}) às ${horarioEscolhido}.\nESCREVA "VOLTAR" PARA VOLTAR AO MENU PRINCIPAL`,
            });
            estadosUsuarios[sender] = { etapa: "menu" }; // Volta ao menu
          } catch (error) {
            await sock.sendMessage(sender, {
              text: `❌ ${error.message}`,
            });
          }
        } else {
          await sock.sendMessage(sender, {
            text: "❌ Opção inválida. Por favor, escolha um número da lista de horários.",
          });
        }
      } else {
        await sock.sendMessage(sender, {
          text: "❌ Opção inválida. Por favor, escolha um número da lista de horários.",
        });
      }
      return;
    } else if (estadoUsuario.etapa === "cancelando_agendamento") {
      if (text.match(/^\d+$/)) {
        const indice = parseInt(text);

        try {
          const agendamentoCancelado = await cancelarAgendamento(sender, indice);
          await sock.sendMessage(sender, {
            text: `✅ Agendamento cancelado com sucesso: ${agendamentoCancelado.data} às ${agendamentoCancelado.horario}.\nESCREVA "VOLTAR" PARA VOLTAR AO MENU PRINCIPAL`,
          });
          estadosUsuarios[sender] = { etapa: "menu" }; // Volta ao menu
        } catch (error) {
          await sock.sendMessage(sender, {
            text: `❌ ${error.message}`,
          });
        }
      } else {
        await sock.sendMessage(sender, {
          text: "❌ Opção inválida. Por favor, escolha um número da lista de agendamentos.",
        });
      }
      return;
    }
  });

  return sock;
}

startBot();