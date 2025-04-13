const { makeWASocket, useMultiFileAuthState, DisconnectReason,} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const emoji = require("node-emoji");
const Agendamento = require("../models/Agendamento");
const { Op } = require("sequelize"); // Importe os operadores do Sequelize

// SEU NÚMERO DE TELEFONE COMPLETO (COM CÓDIGO DO PAÍS E ÁREA, SEM O +)
const adminNumbers = [
  "@s.whatsapp.net", // seu número atual
  "558192664901@s.whatsapp.net"  // o número antigo
];

async function handleAdminCommands(sock, sender, text) {
  if (!adminNumbers.includes(sender)) return;

  const ajustarFusoHorario = () => {
    const agora = new Date();
    agora.setHours(agora.getHours() - 3);
    return agora;
  };

  const formatarDataBrasileira = (dataISO) => {
    const data = new Date(dataISO);
    const dia = String(data.getDate()).padStart(2, "0");
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
  };

  const formatarAgendamento = (a) =>
    `📌 *ID:* ${a.id}\n👤 *Cliente:* ${a.nome_cliente}\n📅 *Data:* ${formatarDataBrasileira(a.data)}\n⏰ *Hora:* ${a.horario}`;

  const enviarAgendamentos = async (destinatario, titulo, agendamentos) => {
    if (agendamentos.length === 0) {
      await sock.sendMessage(destinatario, { text: "📭 Nenhum agendamento encontrado." });
    } else {
      const resposta = agendamentos.map(formatarAgendamento).join("\n\n");
      await sock.sendMessage(destinatario, { text: `${titulo}\n\n${resposta}` });
    }
  };

  // 📌 Menu principal
  if (text === "!admin") {
    await sock.sendMessage(sender, {
      text:
        `👑 *Menu do Administrador:*\n\n` +
        `1️⃣ Ver agendamentos de hoje\n` +
        `2️⃣ Ver agendamentos da semana\n` +
        `3️⃣ Cancelar agendamento (ex: *!cancelar 123*)\n` +
        `4️⃣ Ver agendamentos por data (ex: *!data 25/04/2025*)\n` +
        `5️⃣ Editar horário do agendamento (ex: *!editar 123 14:00*)\n` +
        `6️⃣ Ver todos os agendamentos futuros\n` +
        `7️⃣ Voltar`
    });
    return;
  }
  

  switch (true) {
    case text === "1": {
      const hoje = ajustarFusoHorario();
      const dataHoje = hoje.toISOString().split("T")[0];

      const agendamentosHoje = await Agendamento.findAll({
        where: { data: { [Op.like]: `${dataHoje}%` } },
        order: [['data', 'ASC'], ['horario', 'ASC']],
      });

      await enviarAgendamentos(sender, "📅 *Agendamentos de hoje:*", agendamentosHoje);
      break;
    }

    case text === "2": {
      const hoje = ajustarFusoHorario();
      const fimSemana = new Date(hoje);
      fimSemana.setDate(hoje.getDate() + 7);

      const dataInicio = hoje.toISOString().split("T")[0];
      const dataFim = fimSemana.toISOString().split("T")[0];

      const agendamentosSemana = await Agendamento.findAll({
        where: {
          data: {
            [Op.between]: [`${dataInicio} 00:00:00`, `${dataFim} 23:59:59`],
          },
        },
        order: [['data', 'ASC'], ['horario', 'ASC']],
      });

      await enviarAgendamentos(sender, "📆 *Agendamentos da semana:*", agendamentosSemana);
      break;
    }

    case /^!cancelar\s+\d+$/.test(text): {
      const id = parseInt(text.split(" ")[1]);
      const agendamento = await Agendamento.findByPk(id);

      if (!agendamento) {
        await sock.sendMessage(sender, { text: "❌ Agendamento não encontrado." });
      } else {
        await agendamento.destroy();
        await sock.sendMessage(sender, { text: `✅ Agendamento com *ID ${id}* foi cancelado.` });
      }
      break;
    }

    case text === "4": {
      await sock.sendMessage(sender, { text: "🔙 Voltando ao menu principal..." });
      break;
    }

    case /^!data\s+\d{2}\/\d{2}\/\d{4}$/.test(text): {
      const dataBr = text.split(" ")[1];
      const [dia, mes, ano] = dataBr.split("/");
      const dataISO = `${ano}-${mes}-${dia}`;

      const agendamentos = await Agendamento.findAll({
        where: { data: { [Op.like]: `${dataISO}%` } },
        order: [['data', 'ASC'], ['horario', 'ASC']],
      });

      await enviarAgendamentos(sender, `📅 *Agendamentos para ${dataBr}:*`, agendamentos);
      break;
    }

    case /^!editar\s+\d+\s+\d{2}:\d{2}$/.test(text): {
      const [, idStr, novoHorario] = text.split(" ");
      const id = parseInt(idStr);
      const agendamento = await Agendamento.findByPk(id);

      if (!agendamento) {
        await sock.sendMessage(sender, { text: "❌ Agendamento não encontrado." });
      } else {
        agendamento.horario = novoHorario;
        await agendamento.save();
        await sock.sendMessage(sender, {
          text: `✏️ Agendamento com ID *${id}* atualizado para *${novoHorario}*.`,
        });
      }
      break;
    }

    case text === "7": {
      const agora = ajustarFusoHorario();
      const dataAtual = agora.toISOString().split("T")[0];

      const agendamentosFuturos = await Agendamento.findAll({
        where: {
          data: {
            [Op.gte]: `${dataAtual} 00:00:00`,
          },
        },
        order: [['data', 'ASC'], ['horario', 'ASC']],
      });

      await enviarAgendamentos(sender, "📅 *Todos os agendamentos futuros:*", agendamentosFuturos);
      break;
    }

    default:
      await sock.sendMessage(sender, {
        text: "❓ Comando inválido. Envie *!admin* para ver o menu.",
      });
  }
}





// Lista de horários disponíveis por dia
const horariosPorDia = {
  segunda: [ "08:00", "08:30", "09:00",  "09:30", "10:00",  "10:30", "11:00", "11:30", "12:00","14:00", "14:30","15:00", "15:30", "16:00", "16:30","17:00","17:30","18:00","18:30", ],
  terca:[ "08:00", "08:30", "09:00",  "09:30", "10:00",  "10:30", "11:00", "11:30", "12:00","14:00", "14:30","15:00", "15:30", "16:00", "16:30","17:00","17:30","18:00","18:30", ],
  quarta:[ "08:00", "08:30", "09:00",  "09:30", "10:00",  "10:30", "11:00", "11:30", "12:00","14:00", "14:30","15:00", "15:30", "16:00", "16:30","17:00","17:30","18:00","18:30", ],
  quinta:[ "08:00", "08:30", "09:00",  "09:30", "10:00",  "10:30", "11:00", "11:30", "12:00","14:00", "14:30","15:00", "15:30", "16:00", "16:30","17:00","17:30","18:00","18:30", ],
  sexta: [ "08:00", "08:30", "09:00",  "09:30", "10:00",  "10:30", "11:00", "11:30", "12:00","14:00", "14:30","15:00", "15:30", "16:00", "16:30","17:00","17:30","18:00","18:30", ],
  sabado: [ "08:00", "08:30", "09:00",  "09:30", "10:00",  "10:30", "11:00", "11:30", "12:00","14:00", "14:30","15:00", "15:30", "16:00", "16:30","17:00","17:30","18:00","18:30", ],
  domingo: [], // Sem horários disponíveis
};

// Objeto para armazenar o estado de cada usuário
const estadosUsuarios = {};

// Função para converter números em emojis
function numeroParaEmoji(numero) {
  const emojis = {
    0: "0️⃣", 1: "1️⃣", 2: "2️⃣", 3: "3️⃣", 4: "4️⃣", 5: "5️⃣", 6: "6️⃣", 7: "7️⃣", 8: "8️⃣", 9: "9️⃣",
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
  const dias = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sabado"];
  const datas = [];
  const hoje = new Date();

  // Ajuste para o fuso horário brasileiro (UTC-3)
  hoje.setHours(hoje.getHours() - 3);

  for (let i = 0; i < 7; i++) {
    const data = new Date(hoje.getTime());
    data.setDate(hoje.getDate() + i);

    const dia = String(data.getDate()).padStart(2, "0");
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const ano = data.getFullYear();

    const dataFormatada = `${dia}/${mes}/${ano}`; // DD/MM/AAAA
    const dataAmericana = `${ano}-${mes}-${dia}`; // YYYY-MM-DD

    datas.push({
      diaSemana: dias[data.getDay()],
      dataFormatada,
      dataAmericana
    });
  }

  return datas;
}


// Função para criar um agendamento
async function criarAgendamento(nome, telefone, dataBrasileira, horario, servico) {
  try {
    // Converte data do formato brasileiro para objeto Date com hora zerada
    const [dia, mes, ano] = dataBrasileira.split("/");
    const dataSomente = new Date(`${ano}-${mes}-${dia}T00:00:00`);
    
    // Verifica se o horário já está agendado para a data
    const agendamentoExistente = await Agendamento.findOne({
      where: {
        data: dataSomente,
        horario: `${horario}:00`,
      },
    });

    if (agendamentoExistente) {
      throw new Error("Horário já agendado para esta data.");
    }

    // Criar o agendamento
    const agendamento = await Agendamento.create({
      nome_cliente: nome,
      telefone,
      data: dataSomente,
      horario: `${horario}:00`,
      servico,
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
      order: [["data", "ASC"]],
      attributes: ["id", "nome_cliente", "data", "horario", "servico"],
    });

    if (!agendamentos || agendamentos.length === 0) {
      return "📅 Você não possui agendamentos. ";
    }

    let resposta = "📅 *Seus agendamentos:*\n\n";

    agendamentos.forEach((agendamento, index) => {
      let dataFormatada = "Data inválida";
      let horarioFormatado = agendamento.horario || "--:--";

      if (typeof agendamento.data === "string") {
        const [dataParte, horaParte] = agendamento.data.split(" ");
        const [ano, mes, dia] = dataParte.split("-");
        dataFormatada = `${dia}/${mes}/${ano}`;
        if (horaParte) horarioFormatado = horaParte.slice(0, 5);
      } else if (agendamento.data instanceof Date) {
        const dataObj = agendamento.data;
        const dia = dataObj.getDate().toString().padStart(2, '0');
        const mes = (dataObj.getMonth() + 1).toString().padStart(2, '0');
        const ano = dataObj.getFullYear();
        dataFormatada = `${dia}/${mes}/${ano}`;
        horarioFormatado = agendamento.horario || dataObj.toTimeString().slice(0, 5);
      }

      const numeroFormatado = numeroParaEmoji(index + 1);
      resposta +=
        `${numeroFormatado} *${agendamento.nome_cliente}*\n` +
        `📅 Data: ${dataFormatada}\n` +
        `⏰ Horário: ${horarioFormatado}\n` +
        `✂️ Serviço: ${agendamento.servico || "Não especificado"}\n\n`;
    });

    resposta += "\n🔹 ESCREVA 'VOLTAR' PARA RETORNAR AO MENU PRINCIPAL";
    return resposta;
  } catch (error) {
    console.error("Erro ao carregar agendamentos:", error);
    return "❌ Ocorreu um erro ao carregar seus agendamentos. Por favor, tente novamente mais tarde.";
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

// Função para listar os agendamentos do dia
async function listarAgendamentosDoDia() {
  try {
    const hoje = new Date();
    hoje.setHours(hoje.getHours() - 3); // Ajuste fuso horário (Brasília)

    // Zera as horas para pegar o início do dia
    const inicioDoDia = new Date(hoje.setHours(0, 0, 0, 0));

    // Para ter certeza que pega só agendamentos do dia exato, criamos o fim do dia também
    const fimDoDia = new Date(inicioDoDia);
    fimDoDia.setHours(23, 59, 59, 999);

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
      const horario = ag.horario?.slice(0, 5) || "--:--";

      resposta += `${numero} *${ag.nome_cliente}*\n`;
      resposta += `⏰ Horário: ${horario}\n`;
      resposta += `✂️ Serviço: ${ag.servico || "Não especificado"}\n\n`;
    });

    return resposta;
  } catch (error) {
    console.error("Erro ao listar agendamentos do dia:", error);
    return "❌ Ocorreu um erro ao buscar os agendamentos de hoje.";
  }
}



//funcao para inicializar o bot
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
      console.log("🔍 Remetente da mensagem:", sender);
    

      const text = (
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        ""
      )
      
        .toLowerCase()
        .trim();
      
      console.log("Texto da mensagem:", text, "De:", sender);
      console.log("Remetente:", sender);
console.log("Admins:", adminNumbers);
      // Verifica se a mensagem é um comando de administrador
      if (sender === adminNumbers[0] && text === "!agendamentos") {
        console.log("✅ Admin autenticado! Enviando agendamentos.");
      }
      

      // Comando de administrador para listar agendamentos do dia
      if (sender === adminNumbers[0] && text === "!agendamentos") {
        console.log("Comando de administrador detectado: listar agendamentos do dia.");
        const listaDeAgendamentos = await listarAgendamentosDoDia();
        await sock.sendMessage(sender, { text: listaDeAgendamentos });
        return;
      }

      // Verificar se a mensagem veio de um administrador e processar comandos de administrador
      if (adminNumbers.includes(sender)) {
        await handleAdminCommands(sock, sender, text);
        return; // Importante: sair para não processar como mensagem de cliente comum
      }

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
            const dataCancelada =
              agendamentoCancelado.data instanceof Date
                ? agendamentoCancelado.data.toLocaleDateString("pt-BR")
                : new Date(agendamentoCancelado.data).toLocaleDateString(
                  "pt-BR"
                );
            await sock.sendMessage(sender, {
              text: `✅ Agendamento cancelado com sucesso para o dia ${dataCancelada} às ${agendamentoCancelado.horario}.\nESCREVA "VOLTAR" PARA RETORNAR AO MENU PRINCIPAL`,
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