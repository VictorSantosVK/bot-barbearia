const readline = require("readline");
const {
  horariosPorDia,
  estadosUsuarios,
  numeroParaEmoji,
  obterProximosDias,
  criarAgendamento,
  listarAgendamentos,
  cancelarAgendamento,
  listarAgendamentosDoDia,
  handleAdminCommands,
} = require("./bot/baileysBot");

const adminNumbers = [
  "@s.whatsapp.net",
  "558192664901@s.whatsapp.net",
];

const sender = "teste-terminal@s.whatsapp.net";

// Sock falso: em vez de mandar mensagem no WhatsApp, imprime no terminal
const fakeSock = {
  sendMessage: async (destinatario, mensagem) => {
    console.log("\n🤖 Bot:");
    console.log(mensagem.text);
    console.log("");
  },
};

async function processarMensagemTerminal(textoOriginal) {
  try {
    const senderAtual = sender;

    const text = textoOriginal.toLowerCase().trim();

    if (!text) return;

    if (text === "hoje") {
      const resposta = await listarAgendamentosDoDia();
      await fakeSock.sendMessage(senderAtual, { text: resposta });
      return;
    }

    if (adminNumbers.includes(senderAtual)) {
      await handleAdminCommands(fakeSock, senderAtual, text);
      return;
    }

    const estadoUsuario = estadosUsuarios[senderAtual] || {
      etapa: "solicitando_nome",
    };

    if (text === "voltar") {
      estadosUsuarios[senderAtual] = { ...estadoUsuario, etapa: "menu" };
      await fakeSock.sendMessage(senderAtual, {
        text:
          "💈 Olá, Somos a barbearia JK2! 💈\n" +
          "Escolha uma opção:\n\n" +
          "1️⃣ Ver horários\n" +
          "2️⃣ Agendar horário\n" +
          "3️⃣ Meus agendamentos\n" +
          "4️⃣ Cancelar agendamento",
      });
      return;
    }

    if (estadoUsuario.etapa === "solicitando_nome") {
      if (!estadoUsuario.nomeSolicitado) {
        await fakeSock.sendMessage(senderAtual, {
          text: "💈 OLÁ, SOMOS A BARBEARIA JK2! INFORME SEU NOME: 💈",
        });

        estadoUsuario.nomeSolicitado = true;
        estadosUsuarios[senderAtual] = estadoUsuario;
        return;
      }

      if (estadoUsuario.nomeSolicitado && text) {
        estadoUsuario.nome = text;
        estadoUsuario.nomeSolicitado = false;
        estadoUsuario.etapa = "menu";
        estadosUsuarios[senderAtual] = estadoUsuario;

        await fakeSock.sendMessage(senderAtual, {
          text:
            `💈 Olá, ${estadoUsuario.nome}! Bem-vindo à barbearia JK2. 💈\n` +
            "Escolha uma opção:\n\n" +
            "1️⃣ Ver horários\n" +
            "2️⃣ Agendar horário\n" +
            "3️⃣ Meus agendamentos\n" +
            "4️⃣ Cancelar agendamento",
        });
        return;
      }
    }

    if (estadoUsuario.etapa === "menu") {
      if (text.includes("1") || text.includes("horários")) {
        await fakeSock.sendMessage(senderAtual, {
          text:
            "💈 Segunda à sexta das 8h às 19:00! 💈\n" +
            "💈 Aos sábados das 8 às 18:00! 💈\n\n" +
            "ESCREVA 'VOLTAR' PARA RETORNAR AO MENU PRINCIPAL",
        });
        return;
      }

      if (text.includes("2") || text.includes("agendar")) {
        await fakeSock.sendMessage(senderAtual, {
          text:
            "💈 Escolha o tipo de serviço:\n\n" +
            "1️⃣ Cabelo\n" +
            "2️⃣ Cabelo e Barba\n\n" +
            "ESCREVA 'VOLTAR' PARA RETORNAR AO MENU PRINCIPAL",
        });

        estadosUsuarios[senderAtual] = {
          ...estadoUsuario,
          etapa: "escolhendo_servico",
        };
        return;
      }

      if (text.includes("3") || text.includes("agendamentos")) {
        const agendamentos = await listarAgendamentos(senderAtual);
        await fakeSock.sendMessage(senderAtual, { text: agendamentos });
        return;
      }

      if (text.includes("4") || text.includes("cancelar")) {
        const agendamentos = await listarAgendamentos(senderAtual);

        await fakeSock.sendMessage(senderAtual, {
          text:
            `${agendamentos}` +
            "🔹 Escolha o número do agendamento que deseja cancelar:\n\n" +
            "🔹 ESCREVA 'VOLTAR' PARA RETORNAR AO MENU PRINCIPAL",
        });

        estadosUsuarios[senderAtual] = {
          ...estadoUsuario,
          etapa: "cancelando_agendamento",
        };
        return;
      }

      await fakeSock.sendMessage(senderAtual, {
        text:
          "💈 Olá, Somos a barbearia JK2! 💈\n" +
          "Escolha uma opção:\n\n" +
          "1️⃣ Ver horários\n" +
          "2️⃣ Agendar horário\n" +
          "3️⃣ Meus agendamentos\n" +
          "4️⃣ Cancelar agendamento",
      });
      return;
    }

    if (estadoUsuario.etapa === "escolhendo_servico") {
      if (text.includes("1") || text.includes("cabelo")) {
        estadoUsuario.servico = "Cabelo";
      } else if (text.includes("2") || text.includes("barba")) {
        estadoUsuario.servico = "Cabelo e Barba";
      } else {
        await fakeSock.sendMessage(senderAtual, {
          text: "❌ Opção inválida. Escolha 1️⃣ para Cabelo ou 2️⃣ para Cabelo e Barba.",
        });
        return;
      }

      estadosUsuarios[senderAtual] = {
        ...estadoUsuario,
        etapa: "escolhendo_data",
      };

      const datasDisponiveis = obterProximosDias();

      let resposta = "📅 Escolha uma data para o agendamento:\n";

      datasDisponiveis.forEach((data, index) => {
        const numeroFormatado = numeroParaEmoji(index + 1);
        resposta += `${numeroFormatado} ${data.diaSemana} (${data.dataFormatada})\n`;
      });

      resposta += "\nESCREVA 'VOLTAR' PARA RETORNAR AO MENU PRINCIPAL";

      await fakeSock.sendMessage(senderAtual, { text: resposta });
      return;
    }

    if (estadoUsuario.etapa === "escolhendo_data") {
      if (!text.match(/^[1-7]$/)) {
        await fakeSock.sendMessage(senderAtual, {
          text: "❌ Opção inválida. Escolha um número da lista de datas.",
        });
        return;
      }

      const escolhaIndex = parseInt(text) - 1;
      const datasDisponiveis = obterProximosDias();
      const dataEscolhida = datasDisponiveis[escolhaIndex];

      const horariosDisponiveis = horariosPorDia[dataEscolhida.diaSemana] || [];

      if (horariosDisponiveis.length === 0) {
        await fakeSock.sendMessage(senderAtual, {
          text: `❌ Não há horários disponíveis para ${dataEscolhida.diaSemana} (${dataEscolhida.dataFormatada}).`,
        });
        return;
      }

      let resposta = `⏳ Escolha um horário disponível para ${dataEscolhida.diaSemana} (${dataEscolhida.dataFormatada}):\n`;

      horariosDisponiveis.forEach((horario, index) => {
        const numeroFormatado = numeroParaEmoji(index + 1);
        resposta += `${numeroFormatado} ${horario}\n`;
      });

      resposta += "\nESCREVA 'VOLTAR' PARA RETORNAR AO MENU PRINCIPAL";

      await fakeSock.sendMessage(senderAtual, { text: resposta });

      estadosUsuarios[senderAtual] = {
        ...estadoUsuario,
        etapa: "escolhendo_horario",
        dataEscolhida,
      };

      return;
    }

    if (estadoUsuario.etapa === "escolhendo_horario") {
      if (!text.match(/^\d+$/)) {
        await fakeSock.sendMessage(senderAtual, {
          text: "❌ Opção inválida. Escolha um número da lista de horários.",
        });
        return;
      }

      const escolhaIndex = parseInt(text) - 1;
      const horariosDisponiveis =
        horariosPorDia[estadoUsuario.dataEscolhida.diaSemana] || [];

      if (escolhaIndex < 0 || escolhaIndex >= horariosDisponiveis.length) {
        await fakeSock.sendMessage(senderAtual, {
          text: "❌ Opção inválida. Escolha um número da lista de horários.",
        });
        return;
      }

      const horarioEscolhido = horariosDisponiveis[escolhaIndex];

      try {
        await criarAgendamento(
          estadoUsuario.nome || "Cliente",
          senderAtual,
          estadoUsuario.dataEscolhida.dataFormatada,
          horarioEscolhido,
          estadoUsuario.servico
        );

        await fakeSock.sendMessage(senderAtual, {
          text:
            `✅ Seu horário foi agendado com sucesso para ` +
            `${estadoUsuario.dataEscolhida.diaSemana} ` +
            `(${estadoUsuario.dataEscolhida.dataFormatada}) às ${horarioEscolhido}.\n\n` +
            `ESCREVA "VOLTAR" PARA RETORNAR AO MENU PRINCIPAL`,
        });

        estadosUsuarios[senderAtual] = {
          ...estadoUsuario,
          etapa: "menu",
        };
      } catch (error) {
        await fakeSock.sendMessage(senderAtual, {
          text: `❌ ${error.message}`,
        });
      }

      return;
    }

    if (estadoUsuario.etapa === "cancelando_agendamento") {
      if (!text.match(/^\d+$/)) {
        await fakeSock.sendMessage(senderAtual, {
          text: "❌ Opção inválida. Escolha um número da lista de agendamentos.",
        });
        return;
      }

      const indice = parseInt(text);

      try {
        const agendamentoCancelado = await cancelarAgendamento(senderAtual, indice);

        const dataCancelada =
          agendamentoCancelado.data instanceof Date
            ? agendamentoCancelado.data.toLocaleDateString("pt-BR")
            : new Date(agendamentoCancelado.data).toLocaleDateString("pt-BR");

        await fakeSock.sendMessage(senderAtual, {
          text:
            `✅ Agendamento cancelado com sucesso para o dia ${dataCancelada} ` +
            `às ${agendamentoCancelado.horario}.\n` +
            `ESCREVA "VOLTAR" PARA RETORNAR AO MENU PRINCIPAL`,
        });

        estadosUsuarios[senderAtual] = {
          ...estadoUsuario,
          etapa: "menu",
        };
      } catch (error) {
        await fakeSock.sendMessage(senderAtual, {
          text: `❌ ${error.message}`,
        });
      }

      return;
    }
  } catch (error) {
    console.error("Erro ao processar mensagem no terminal:", error);

    await fakeSock.sendMessage(sender, {
      text: "❌ Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde.",
    });
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("💈 Chatbot da Barbearia JK2 iniciado no terminal.");
console.log("Digite uma mensagem como se fosse o cliente.");
console.log("Digite 'sair' para encerrar.\n");

function perguntar() {
  rl.question("👤 Cliente: ", async (mensagem) => {
    if (mensagem.toLowerCase().trim() === "sair") {
      console.log("Bot encerrado.");
      rl.close();
      return;
    }

    await processarMensagemTerminal(mensagem);
    perguntar();
  });
}

perguntar();