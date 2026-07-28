const readline = require("readline");
const {
  estadosUsuarios,
  processarMensagemCliente,
  handleAdminCommands,
  listarAgendamentosDoDia,
} = require("./bot/baileysBot");

// Mesma lista de números admin usada pelo bot real (bot/baileysBot.js).
const adminNumbers = [
  "@s.whatsapp.net",
  "558192664901@s.whatsapp.net",
];

const senderCliente = "teste-terminal@s.whatsapp.net";
const senderAdmin = adminNumbers[1];

// Controla se as mensagens digitadas devem ser tratadas como cliente ou
// como admin. Troca com "!modo admin" / "!modo cliente".
let modoAdmin = false;

// Sock falso: em vez de mandar mensagem no WhatsApp, imprime no terminal.
const fakeSock = {
  sendMessage: async (destinatario, mensagem) => {
    console.log("\n🤖 Bot:");
    console.log(mensagem.text);
    console.log("");
  },
};

async function processarMensagemTerminal(textoOriginal) {
  const textoTrim = textoOriginal.trim();
  const comando = textoTrim.toLowerCase();

  // ---- Comandos exclusivos do terminal de teste ----
  if (comando === "!modo admin") {
    modoAdmin = true;
    console.log("\n🔧 Modo administrador ativado. Envie !admin para ver o menu.\n");
    return;
  }

  if (comando === "!modo cliente") {
    modoAdmin = false;
    console.log("\n🔧 Modo cliente ativado.\n");
    return;
  }

  if (comando === "!reset") {
    const senderAtual = modoAdmin ? senderAdmin : senderCliente;
    delete estadosUsuarios[senderAtual];
    console.log("\n🔄 Estado da conversa resetado. Envie qualquer mensagem para começar de novo.\n");
    return;
  }

  if (comando === "!ajuda") {
    mostrarAjuda();
    return;
  }

  if (!textoTrim) return;

  const senderAtual = modoAdmin ? senderAdmin : senderCliente;
  const text = comando;

  try {
    if (modoAdmin) {
      // Atalho que existe no bot real só para o primeiro número admin.
      if (text === "!agendamentos") {
        const resposta = await listarAgendamentosDoDia();
        await fakeSock.sendMessage(senderAtual, { text: resposta });
        return;
      }

      await handleAdminCommands(fakeSock, senderAtual, text);
      return;
    }

    await processarMensagemCliente(fakeSock, senderAtual, text);
  } catch (error) {
    console.error("Erro ao processar mensagem no terminal:", error);

    await fakeSock.sendMessage(senderAtual, {
      text: "❌ Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde.",
    });
  }
}

function mostrarAjuda() {
  console.log(
    "\n📋 Comandos do terminal de teste:\n" +
      "  !modo cliente   -> simula mensagens como cliente (padrão)\n" +
      "  !modo admin     -> simula mensagens como admin (habilita !admin, !cancelar, etc.)\n" +
      "  !reset          -> reseta o estado da conversa do modo atual\n" +
      "  !ajuda          -> mostra esta lista\n" +
      "  sair            -> encerra o terminal\n"
  );
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("💈 Chatbot da Barbearia JK2 iniciado no terminal.");
console.log("Digite uma mensagem como se fosse o cliente.");
mostrarAjuda();

function perguntar() {
  const rotulo = modoAdmin ? "👑 Admin" : "👤 Cliente";

  rl.question(`${rotulo}: `, async (mensagem) => {
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