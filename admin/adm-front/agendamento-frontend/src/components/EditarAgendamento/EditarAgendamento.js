import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

function EditarAgendamento() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [agendamento, setAgendamento] = useState({
    nome_cliente: '',
    telefone: '',
    data: '',
    horario: '',
    servico: '',
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await axios.get(`http://localhost:3001/agendamentos/${id}`, {
          headers: {
            usuario: 'admin',
            senha: 'senha123',
          },
        });
        setAgendamento(response.data);
      } catch (error) {
        console.error('Erro ao buscar agendamento:', error);
      }
    }
    fetchData();
  }, [id]);

  const handleChange = (e) => {
    setAgendamento({ ...agendamento, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`http://localhost:3001/agendamentos/${id}`, agendamento, {
        headers: {
          usuario: 'admin',
          senha: 'senha123',
        },
      });
      navigate('/');
    } catch (error) {
      console.error('Erro ao atualizar agendamento:', error);
    }
  };

  return (
    <div>
      <h2>Editar Agendamento</h2>
      <form onSubmit={handleSubmit}>
        <input type="text" name="nome_cliente" value={agendamento.nome_cliente} onChange={handleChange} placeholder="Nome" />
        <input type="text" name="telefone" value={agendamento.telefone} onChange={handleChange} placeholder="Telefone" />
        <input type="date" name="data" value={agendamento.data} onChange={handleChange} />
        <input type="time" name="horario" value={agendamento.horario} onChange={handleChange} />
        <input type="text" name="servico" value={agendamento.servico} onChange={handleChange} placeholder="Serviço" />
        <button type="submit">Salvar</button>
      </form>
    </div>
  );
}

export default EditarAgendamento;