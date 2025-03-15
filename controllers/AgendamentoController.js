const db = require("../database/connection");

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

async function listarAgendamentos(telefone) {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT horario FROM agendamentos WHERE telefone = ?",
      [telefone],
      (err, results) => {
        if (err) reject(err);
        if (results.length === 0) resolve("📅 Nenhum agendamento encontrado.");
        else resolve(results.map((a) => `🕒 ${a.horario}`).join("\n"));
      }
    );
  });
}

module.exports = { criarAgendamento, listarAgendamentos };
