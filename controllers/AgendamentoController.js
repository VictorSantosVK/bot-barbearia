const Agendamento = require("../models/Agendamento");

async function criarAgendamento(nome_cliente, telefone, horario, servico) {
  try {
    const agendamento = await Agendamento.create({
      nome_cliente,
      telefone,
      horario,
      servico,
    });
    return agendamento;
  } catch (error) {
    throw new Error("Erro ao criar agendamento: " + error.message);
  }
}

async function listarAgendamentos(telefone) {
  try {
    const agendamentos = await Agendamento.findAll({
      where: { telefone },
      attributes: ["horario"],
    });

    if (agendamentos.length === 0) {
      return "📅 Nenhum agendamento encontrado.";
    }

    return agendamentos.map((a) => `🕒 ${a.horario}`).join("\n");
  } catch (error) {
    throw new Error("Erro ao listar agendamentos: " + error.message);
  }
}

module.exports = { criarAgendamento, listarAgendamentos };