const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const emoji = require("node-emoji");
const Agendamento = require("../models/Agendamento");

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
  domingo: [], // Sem horários disponíveis
};

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
  const dias = [
    "domingo",
    "segunda",
    "terca",
    "quarta",
    "quinta",
    "sexta",
    "sabado",
  ];
  const datas = [];
  const hoje = new Date();

  for (let i = 0; i < 7; i++) {
    const data = new Date(hoje);
    data.setDate(hoje.getDate() + i);
    const diaSemana = dias[data.getDay()];
    const dataFormatada = data.toLocaleDateString("pt-BR"); // Formato brasileiro: dd/MM/yyyy
    const dataAmericana = data.toISOString().split("T")[0]; // Formato americano: yyyy-MM-dd
    datas.push({ diaSemana, dataFormatada, dataAmericana });
  }

  return datas;
}

// Função para criar um agendamento
async function criarAgendamento(
  nome,
  telefone,
  dataBrasileira,
  horario,
  servico
) {
  try {
    // Converte a data do formato brasileiro (dd/MM/yyyy) para o formato americano (yyyy-MM-dd)
    function converterDataParaAmericano(dataBrasileira) {
      const [dia, mes, ano] = dataBrasileira.split("/");
      return `${ano}-${mes}-${dia}`; // Formato americano: yyyy-MM-dd
    }

    const dataAmericana = converterDataParaAmericano(dataBrasileira);

    // Combina a data e o horário no formato MySQL (YYYY-MM-DD HH:mm:ss)
    const dataHorarioMySQL = `${dataAmericana} ${horario}:00`;

    // Verificar se o horário já está agendado para a data escolhida
    const agendamentoExistente = await Agendamento.findOne({
      where: { data: dataHorarioMySQL },
    });

    if (agendamentoExistente) {
      throw new Error("Horário já agendado para esta data.");
    }

    // Criar o agendamento no banco de dados
    const agendamento = await Agendamento.create({
      nome_cliente: nome,
      telefone,
      data: dataHorarioMySQL, // Usa o formato MySQL
      horario, // Certifique-se de que o horário está sendo passado
      servico, // Tipo de serviço escolhido
    });

    console.log("Agendamento criado:", agendamento);
    return agendamento;
  } catch (error) {
    throw new Error("Erro ao criar agendamento: " + error.message);
  }
}

// Função para listar agendamentos de um cliente específico

// Função para listar agendamentos de um cliente específico
async function listarAgendamentos(telefoneCliente) {
  try {
    console.log(`Buscando agendamentos para: ${telefoneCliente}`);

    // Buscar agendamentos no banco de dados com tratamento de erro
    const agendamentos = await Agendamento.findAll({
      where: { telefone: telefoneCliente },
      order: [["data", "ASC"]],
      attributes: ["id", "nome_cliente", "data", "horario", "servico"],
    }).catch((err) => {
      console.error("Erro na consulta ao banco:", err);
      throw err;
    });

    if (!agendamentos || agendamentos.length === 0) {
      console.log("Nenhum agendamento encontrado");
      return "📅 Você não possui agendamentos. \n\n ESCREVA 'VOLTAR' PARA RETORNAR AO MENU PRINCIPAL";
    }

    console.log(`Encontrados ${agendamentos.length} agendamentos`);

    let resposta = "📅 *Seus agendamentos:*\n\n";

    agendamentos.forEach((agendamento, index) => {
      try {
        // Verifica se os dados necessários existem
        if (!agendamento.data || !agendamento.nome_cliente) {
          console.warn(`Agendamento ${agendamento.id} com dados incompletos`);
          return;
        }

        // Extrai e formata a data
        let dataFormatada;
        let horarioFormatado;

        if (typeof agendamento.data === "string") {
          // Formato ISO (YYYY-MM-DD HH:mm:ss)
          const [dataPart, horaPart] = agendamento.data.split(" ");
          const [ano, mes, dia] = dataPart.split("-");
          dataFormatada = `${mes}/${dia}/${ano}`; // Changed to MM/DD/YYYY format
          horarioFormatado = horaPart
            ? horaPart.substring(0, 5)
            : agendamento.horario || "--:--";
        } else if (agendamento.data instanceof Date) {
          // Objeto Date - changed to American format
          dataFormatada = `${(agendamento.data.getMonth() + 1).toString().padStart(2, '0')}/${agendamento.data.getDate().toString().padStart(2, '0')}/${agendamento.data.getFullYear()}`;
          horarioFormatado = agendamento.horario || "--:--";
        } else {
          console.warn(
            `Formato de data inválido no agendamento ${agendamento.id}`
          );
          dataFormatada = "Data inválida";
          horarioFormatado = "--:--";
        }

        const numeroFormatado = numeroParaEmoji(index + 1);

        resposta +=
          `${numeroFormatado} *${agendamento.nome_cliente || "Sem nome"}*\n` +
          `📅 Data: ${dataFormatada}\n` +
          `⏰ Horário: ${horarioFormatado}\n` +
          `✂️ Serviço: ${agendamento.servico || "Não especificado"}\n\n`;
      } catch (error) {
        console.error(
          `Erro ao processar agendamento ${agendamento.id}:`,
          error
        );
        resposta += `⚠️ Agendamento #${
          index + 1
        } com informações incompletas\n\n`;
      }
    });

    resposta += "\n🔹 ESCREVA 'VOLTAR' PARA RETORNAR AO MENU PRINCIPAL";

    return resposta;
  } catch (error) {
    console.error("Erro detalhado ao carregar agendamentos:", error);
    return "❌ Ocorreu um erro ao carregar seus agendamentos. Por favor, tente novamente mais tarde ou entre em contato com o suporte.";
  }
}

// Função para cancelar um agendamento
async function cancelarAgendamento(telefoneCliente, indice) {
  try {
    // Buscar agendamentos do cliente
    const agendamentos = await Agendamento.findAll({
      where: { telefone: telefoneCliente },
    });

    if (indice < 1 || indice > agendamentos.length) {
      throw new Error("Índice inválido.");
    }

    // Selecionar o agendamento a ser cancelado
    const agendamentoCancelado = agendamentos[indice - 1];

    // Deletar o agendamento do banco de dados
    await Agendamento.destroy({
      where: { id: agendamentoCancelado.id },
    });

    console.log("Agendamento cancelado:", agendamentoCancelado);
    return agendamentoCancelado;
  } catch (error) {
    throw new Error("Erro ao cancelar agendamento: " + error.message);
  }
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
    try {
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
      const estadoUsuario = estadosUsuarios[sender] || {
        etapa: "solicitando_nome",
      };

      // Verificar se o usuário quer voltar ao menu principal
      if (text === "voltar") {
        estadosUsuarios[sender] = { ...estadoUsuario, etapa: "menu" }; // Volta ao menu
        await sock.sendMessage(sender, {
          text: "💈 Olá, Somos a barbearia JK2! 💈\nEscolha uma opção:\n\n1️⃣ Ver horários\n2️⃣ Agendar horário\n3️⃣ Meus agendamentos\n4️⃣ Cancelar agendamento",
        });
        return;
      }

      if (estadoUsuario.etapa === "solicitando_nome") {
        // Se o nome ainda não foi informado, pedir o nome
        if (!estadoUsuario.nomeSolicitado) {
          await sock.sendMessage(sender, {
            text: "💈 OLÁ, SOMOS A BARBEARIA JK2! INFORME SEU NOME: 💈",
          });
          // Marcar que o nome foi solicitado
          estadoUsuario.nomeSolicitado = true;
          estadosUsuarios[sender] = estadoUsuario;
          return;
        }

        // Se o nome foi solicitado e o usuário respondeu, salvar o nome
        if (estadoUsuario.nomeSolicitado && text) {
          estadoUsuario.nome = text;
          estadoUsuario.nomeSolicitado = false; // Resetar o flag
          estadoUsuario.etapa = "menu"; // Avançar para o menu
          estadosUsuarios[sender] = estadoUsuario;

          await sock.sendMessage(sender, {
            text: `💈 Olá, ${estadoUsuario.nome}! Bem-vindo à barbearia JK2. 💈\nEscolha uma opção:\n\n1️⃣ Ver horários\n2️⃣ Agendar horário\n3️⃣ Meus agendamentos\n4️⃣ Cancelar agendamento`,
          });
          return;
        }
      } else if (estadoUsuario.etapa === "menu") {
        if (text.includes("1") || text.includes("horários")) {
          console.log("Opção 1 selecionada: Ver horários");
          await sock.sendMessage(sender, {
            text: "💈 Segunda à sexta das 8h às 19:00! 💈 \n💈Aos sábados das 8 às 18:00! 💈 \n\n ESCREVA 'VOLTAR' PARA RETORNAR AO MENU PRINCIPAL",
          });
          return;
        } else if (text.includes("2") || text.includes("agendar")) {
          console.log("Opção 2 selecionada: Agendar horário");
          await sock.sendMessage(sender, {
            text: "💈 Escolha o tipo de serviço:\n\n1️⃣ Cabelo\n2️⃣ Cabelo e Barba\n\nESCREVA 'VOLTAR' PARA RETORNAR AO MENU PRINCIPAL",
          });
          estadosUsuarios[sender] = {
            ...estadoUsuario,
            etapa: "escolhendo_servico",
          }; // Atualiza o estado
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
            text: `${agendamentos}\n\n🔹 Escolha o número do agendamento que deseja cancelar: \n\n ESCREVA "VOLTAR" PARA RETORNAR AO MENU PRINCIPAL`,
          });
          estadosUsuarios[sender] = {
            ...estadoUsuario,
            etapa: "cancelando_agendamento",
          }; // Atualiza o estado
          return;
        } else {
          console.log("Nenhuma opção válida selecionada. Exibindo menu.");
          await sock.sendMessage(sender, {
            text: "💈 Olá, Somos a barbearia JK2! 💈\nEscolha uma opção:\n\n1️⃣ Ver horários\n2️⃣ Agendar horário\n3️⃣ Meus agendamentos\n4️⃣ Cancelar agendamento",
          });
          return;
        }
      } else if (estadoUsuario.etapa === "escolhendo_servico") {
        if (text.includes("1") || text.includes("cabelo")) {
          estadoUsuario.servico = "Cabelo"; // Armazena o tipo de serviço
          estadosUsuarios[sender] = {
            ...estadoUsuario,
            etapa: "escolhendo_data",
          }; // Avança para escolher a data

          const datasDisponiveis = obterProximosDias();
          let resposta = "📅 Escolha uma data para o agendamento:\n";
          datasDisponiveis.forEach((data, index) => {
            const numeroFormatado = numeroParaEmoji(index + 1); // Converte o número para emoji
            resposta += `${numeroFormatado} ${data.diaSemana} (${data.dataFormatada})\n`;
          });
          resposta += "\nESCREVA 'VOLTAR' PARA RETORNAR AO MENU PRINCIPAL";
          await sock.sendMessage(sender, { text: resposta });
          return;
        } else if (text.includes("2") || text.includes("barba")) {
          estadoUsuario.servico = "Cabelo e Barba"; // Armazena o tipo de serviço
          estadosUsuarios[sender] = {
            ...estadoUsuario,
            etapa: "escolhendo_data",
          }; // Avança para escolher a data

          const datasDisponiveis = obterProximosDias();
          let resposta = "📅 Escolha uma data para o agendamento:\n";
          datasDisponiveis.forEach((data, index) => {
            const numeroFormatado = numeroParaEmoji(index + 1); // Converte o número para emoji
            resposta += `${numeroFormatado} ${data.diaSemana} (${data.dataFormatada})\n`;
          });
          resposta += "\nESCREVA 'VOLTAR' PARA RETORNAR AO MENU PRINCIPAL";
          await sock.sendMessage(sender, { text: resposta });
          return;
        } else {
          await sock.sendMessage(sender, {
            text: "❌ Opção inválida. Por favor, escolha 1️⃣ para Cabelo ou 2️⃣ para Cabelo e Barba.",
          });
          return;
        }
      } else if (estadoUsuario.etapa === "escolhendo_data") {
        if (text.match(/^[1-7]$/)) {
          const escolhaIndex = parseInt(text) - 1;
          const datasDisponiveis = obterProximosDias();
          const dataEscolhida = datasDisponiveis[escolhaIndex];

          if (dataEscolhida) {
            const horariosDisponiveis =
              horariosPorDia[dataEscolhida.diaSemana] || [];
            if (horariosDisponiveis.length === 0) {
              await sock.sendMessage(sender, {
                text: `❌ Não há horários disponíveis para ${dataEscolhida.diaSemana} (${dataEscolhida.dataFormatada}).`,
              });
              return;
            }

            let resposta = `⏳ Escolha um horário disponível para ${dataEscolhida.diaSemana} (${dataEscolhida.dataFormatada}):\n`;
            horariosDisponiveis.forEach((horario, index) => {
              const numeroFormatado = numeroParaEmoji(index + 1); // Converte o número para emoji
              resposta += `${numeroFormatado} ${horario}\n`;
            });
            resposta += "\nESCREVA 'VOLTAR' PARA RETORNAR AO MENU PRINCIPAL";
            await sock.sendMessage(sender, { text: resposta });
            estadosUsuarios[sender] = {
              ...estadoUsuario,
              etapa: "escolhendo_horario",
              dataEscolhida,
            }; // Atualiza o estado
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
        if (text.match(/^\d+$/)) {
          const escolhaIndex = parseInt(text) - 1;
          const horariosDisponiveis =
            horariosPorDia[estadoUsuario.dataEscolhida.diaSemana] || [];

          if (escolhaIndex >= 0 && escolhaIndex < horariosDisponiveis.length) {
            const horarioEscolhido = horariosDisponiveis[escolhaIndex];

            try {
              await criarAgendamento(
                estadoUsuario.nome || "Cliente", // Usa o nome capturado
                sender,
                estadoUsuario.dataEscolhida.dataFormatada,
                horarioEscolhido, // Passa o horário corretamente
                estadoUsuario.servico // Passa o tipo de serviço escolhido
              );
              await sock.sendMessage(sender, {
                text: `✅ Seu horário foi agendado com sucesso para ${estadoUsuario.dataEscolhida.diaSemana} (${estadoUsuario.dataEscolhida.dataFormatada}) às ${horarioEscolhido}.\n\nESCREVA "VOLTAR" PARA RETORNAR AO MENU PRINCIPAL`,
              });
              estadosUsuarios[sender] = { ...estadoUsuario, etapa: "menu" }; // Volta ao menu
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
            const agendamentoCancelado = await cancelarAgendamento(
              sender,
              indice
            );
            await sock.sendMessage(sender, {
              text: `✅ Agendamento cancelado com sucesso: ${agendamentoCancelado.data} às ${agendamentoCancelado.horario}.\nESCREVA "VOLTAR" PARA RETORNAR AO MENU PRINCIPAL`,
            });
            estadosUsuarios[sender] = { ...estadoUsuario, etapa: "menu" }; // Volta ao menu
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
    } catch (error) {
      console.error("Erro ao processar mensagem:", error);
      await sock.sendMessage(sender, {
        text: "❌ Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde.",
      });
    }
  });

  return sock;
}

startBot();
