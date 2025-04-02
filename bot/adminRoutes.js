const express = require("express");
const router = express.Router();
const Agendamento = require("../models/Agendamento");

// Criar um novo agendamento (Create)
router.post("/agendamentos", async (req, res) => {
  try {
    const { nome_cliente, telefone, data, horario, servico } = req.body;

    const agendamentoExistente = await Agendamento.findOne({ where: { data } });
    if (agendamentoExistente) {
      return res.status(400).json({ error: "Este horário já está agendado." });
    }

    const novoAgendamento = await Agendamento.create({
      nome_cliente,
      telefone,
      data,
      horario,
      servico,
    });

    res.status(201).json(novoAgendamento);
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar agendamento" });
  }
});

// Listar todos os agendamentos (Read)
router.get("/agendamentos", async (req, res) => {
  try {
    const agendamentos = await Agendamento.findAll();
    res.json(agendamentos);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar agendamentos" });
  }
});

// Buscar um agendamento por ID
router.get("/agendamentos/:id", async (req, res) => {
  try {
    const agendamento = await Agendamento.findByPk(req.params.id);
    if (!agendamento) {
      return res.status(404).json({ error: "Agendamento não encontrado" });
    }
    res.json(agendamento);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar agendamento" });
  }
});

// Atualizar um agendamento (Update)
router.put("/agendamentos/:id", async (req, res) => {
  try {
    const { nome_cliente, telefone, data, horario, servico } = req.body;
    const agendamento = await Agendamento.findByPk(req.params.id);

    if (!agendamento) {
      return res.status(404).json({ error: "Agendamento não encontrado" });
    }

    agendamento.nome_cliente = nome_cliente || agendamento.nome_cliente;
    agendamento.telefone = telefone || agendamento.telefone;
    agendamento.data = data || agendamento.data;
    agendamento.horario = horario || agendamento.horario;
    agendamento.servico = servico || agendamento.servico;

    await agendamento.save();
    res.json(agendamento);
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar agendamento" });
  }
});

// Deletar um agendamento (Delete)
router.delete("/agendamentos/:id", async (req, res) => {
  try {
    const agendamento = await Agendamento.findByPk(req.params.id);
    if (!agendamento) {
      return res.status(404).json({ error: "Agendamento não encontrado" });
    }

    await agendamento.destroy();
    res.json({ message: "Agendamento deletado com sucesso!" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao deletar agendamento" });
  }
});

module.exports = router;
