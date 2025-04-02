import React, { useState, useEffect } from "react";
import axios from "axios";
import "./AgendamentoList.css";
import { useNavigate } from "react-router-dom";

const AgendamentosList = () => {
  // Estados
  const [agendamentos, setAgendamentos] = useState([]);
  const [telefone, setTelefone] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    nome_cliente: "",
    telefone: "",
    data: "",
    horario: "",
    servico: "",
    horariosDisponiveis: []
  });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [agendamentoToDelete, setAgendamentoToDelete] = useState(null);
  const navigate = useNavigate();

  // Horários disponíveis por dia da semana
  const horariosPorDia = {
    segunda: ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"],
    terca: ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"],
    quarta: ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"],
    quinta: ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"],
    sexta: ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"],
    sabado: ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"],
    domingo: []
  };

  // Função para normalizar datas sem problemas de fuso horário
  const normalizeDate = (dateString) => {
    if (!dateString) return null;
    
    // Se já está no formato YYYY-MM-DD
    if (typeof dateString === 'string' && dateString.includes('-')) {
      const [year, month, day] = dateString.split('-');
      return new Date(year, month - 1, day);
    }
    
    // Se está no formato DD/MM/YYYY
    if (typeof dateString === 'string' && dateString.includes('/')) {
      const [day, month, year] = dateString.split('/');
      return new Date(year, month - 1, day);
    }
    
    // Se já é um objeto Date
    if (dateString instanceof Date) {
      return new Date(dateString.getFullYear(), dateString.getMonth(), dateString.getDate());
    }
    
    return null;
  };

  // Formatar data para o servidor (YYYY-MM-DD)
  const formatDateForServer = (date) => {
    const normalized = normalizeDate(date);
    if (!normalized) return '';
    
    const year = normalized.getFullYear();
    const month = String(normalized.getMonth() + 1).padStart(2, '0');
    const day = String(normalized.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };

  // Formatar data para exibição (DD/MM/YYYY)
  const formatDateForDisplay = (dateString) => {
    const normalized = normalizeDate(dateString);
    if (!normalized) return '';
    
    const day = String(normalized.getDate()).padStart(2, '0');
    const month = String(normalized.getMonth() + 1).padStart(2, '0');
    const year = normalized.getFullYear();
    
    return `${day}/${month}/${year}`;
  };

  // Função para obter o dia da semana
  const getDiaSemana = (dateString) => {
    const dias = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
    const date = normalizeDate(dateString);
    return dias[date.getDay()];
  };

  // Buscar agendamentos
  const fetchAgendamentos = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      
      const usuario = localStorage.getItem("usuario");
      const senha = localStorage.getItem("senha");
      
      if (!usuario || !senha) {
        navigate('/login'); 
        return;
      }

      const response = await axios.get("http://localhost:3001/agendamentos", {
        headers: { 
          usuario: usuario,
          senha: senha 
        },
        params: { telefone: telefone || undefined }
      });

      if (!response.data || !Array.isArray(response.data)) {
        throw new Error("Formato de dados inválido do servidor");
      }

      const agendamentosFormatados = response.data.map(item => ({
        ...item,
        data: formatDateForDisplay(item.data),
        dataOriginal: item.data
      }));

      setAgendamentos(agendamentosFormatados);
      
    } catch (error) {
      console.error("Erro ao buscar agendamentos:", error);
      
      let message = "Erro ao carregar agendamentos";
      if (error.response) {
        message = error.response.data?.message || `Erro ${error.response.status}`;
      } else if (error.request) {
        message = "Sem resposta do servidor";
      } else {
        message = error.message;
      }
      
      setErrorMessage(message);
      setAgendamentos([]);
      
    } finally {
      setLoading(false);
    }
  };

  // Buscar horários disponíveis
  const fetchHorariosDisponiveis = async (data) => {
    if (!data) return [];
    try {
      const usuario = localStorage.getItem("usuario");
      const senha = localStorage.getItem("senha");
      const response = await axios.get(
        `http://localhost:3001/horarios-disponiveis?data=${data}`,
        { headers: { usuario, senha } }
      );
      return response.data?.horariosLivres || [];
    } catch (error) {
      console.error("Erro ao buscar horários:", error);
      return [];
    }
  };

  useEffect(() => {
    fetchAgendamentos();
  }, [telefone]);

  useEffect(() => {
    if (editingId && editForm.data) {
      const loadHorarios = async () => {
        const horarios = await fetchHorariosDisponiveis(editForm.data);
        setEditForm(prev => ({
          ...prev,
          horariosDisponiveis: horarios,
          horario: horarios.includes(prev.horario) ? prev.horario : ""
        }));
      };
      loadHorarios();
    }
  }, [editForm.data, editingId]);

  // Função para confirmar exclusão
  const confirmDelete = (id) => {
    setAgendamentoToDelete(id);
    setShowDeleteModal(true);
  };

  // Função para executar a exclusão
  const handleConfirmDelete = async () => {
    if (!agendamentoToDelete) return;
    
    setLoading(true);
    try {
      const usuario = localStorage.getItem("usuario");
      const senha = localStorage.getItem("senha");
      
      await axios.delete(`http://localhost:3001/agendamentos/${agendamentoToDelete}`, {
        headers: { 
          usuario, 
          senha,
          'Content-Type': 'application/json'
        }
      });

      setAgendamentos(prev => 
        prev.filter(a => a.id !== agendamentoToDelete)
      );
      await fetchAgendamentos();
      
    } catch (error) {
      console.error("Erro ao deletar agendamento:", error);
      
      let errorMessage = "Erro ao excluir agendamento";
      if (error.response) {
        if (error.response.status === 404) {
          errorMessage = "Agendamento não encontrado (já foi removido)";
        } else if (error.response.data?.error) {
          errorMessage = error.response.data.error;
        }
      }
      
      setErrorMessage(errorMessage);
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
      setAgendamentoToDelete(null);
    }
  };

  const handleEdit = (agendamento) => {
    setEditingId(agendamento.id);
    const dataFormatada = agendamento.dataOriginal || agendamento.data;
    
    setEditForm({
      nome_cliente: agendamento.nome_cliente,
      telefone: agendamento.telefone,
      data: dataFormatada,
      horario: agendamento.horario,
      servico: agendamento.servico,
      horariosDisponiveis: []
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const usuario = localStorage.getItem("usuario");
      const senha = localStorage.getItem("senha");

      const diaSemana = getDiaSemana(editForm.data);
      if (!horariosPorDia[diaSemana]?.includes(editForm.horario)) {
        alert(`Horário não disponível para ${diaSemana}-feira`);
        return;
      }

      // Formata a data corretamente para o servidor
      const dataParaServidor = formatDateForServer(editForm.data);
      
      const response = await axios.put(
        `http://localhost:3001/agendamentos/${editingId}`,
        {
          ...editForm,
          data: dataParaServidor,
          horario: editForm.horario
        },
        { 
          headers: { 
            usuario, 
            senha,
            'Content-Type': 'application/json'
          } 
        }
      );

      setAgendamentos(prev => 
        prev.map(a => 
          a.id === editingId ? {
            ...response.data,
            data: formatDateForDisplay(response.data.data),
            horario: response.data.horario
          } : a
        )
      );

      setEditingId(null);
      setErrorMessage(null);
    } catch (error) {
      console.error("Erro ao atualizar agendamento:", error);
      
      let errorMsg = "Erro ao atualizar agendamento";
      if (error.response) {
        errorMsg = error.response.data?.error || `Erro ${error.response.status}`;
      }
      
      setErrorMessage(errorMsg);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNovoAgendamento = () => {
    navigate("/novoagendamento");
  };

  return (
    <div className="conteudo-principal">
      <div className="agendamentos-container">
        <h1 className="h1-agendamento">Agendamentos</h1>

        <div className="search-bar">
          <input
            type="text"
            placeholder="Filtrar por telefone"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            className="search-input"
          />
          <button onClick={handleNovoAgendamento} className="btn-novo">
            <i className="icon-plus"></i> Novo Agendamento
          </button>
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Carregando agendamentos...</p>
          </div>
        ) : errorMessage ? (
          <div className="error-container">
            <p className="error-message">{errorMessage}</p>
            <button onClick={fetchAgendamentos} className="btn-retry">
              Tentar novamente
            </button>
          </div>
        ) : agendamentos.length > 0 ? (
          <ul className="agendamentos-list">
            {agendamentos.map((agendamento) => (
              <li key={agendamento.id} className="agendamento-item">
                {editingId === agendamento.id ? (
                  <form onSubmit={handleUpdate} className="edit-form">
                    <div className="form-group">
                      <label>Nome</label>
                      <input
                        name="nome_cliente"
                        value={editForm.nome_cliente}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>Telefone</label>
                      <input
                        name="telefone"
                        value={editForm.telefone}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>Data</label>
                      <input
                        type="date"
                        name="data"
                        value={editForm.data}
                        onChange={handleChange}
                        required
                        min={formatDateForServer(new Date())}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>Horário</label>
                      <select
                        name="horario"
                        value={editForm.horario}
                        onChange={handleChange}
                        required
                        disabled={editForm.horariosDisponiveis.length === 0}
                      >
                        <option value="">Selecione um horário</option>
                        {editForm.horariosDisponiveis.map((horario) => (
                          <option key={horario} value={horario}>
                            {horario}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label>Serviço</label>
                      <input
                        name="servico"
                        value={editForm.servico}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    
                    <div className="form-actions">
                      <button type="submit" className="btn-salvar">
                        Salvar
                      </button>
                      <button
                        type="button"
                        className="btn-cancelar"
                        onClick={() => setEditingId(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="agendamento-info">
                      <div className="info-group">
                        <label>Cliente</label>
                        <p>{agendamento.nome_cliente}</p>
                      </div>
                      
                      <div className="info-group">
                        <label>Telefone</label>
                        <p className="truncate">{agendamento.telefone}</p>
                      </div>
                      
                      <div className="info-group">
                        <label>Data</label>
                        <p>{agendamento.data}</p>
                      </div>
                      
                      <div className="info-group">
                        <label>Horário</label>
                        <p>{agendamento.horario}</p>
                      </div>
                      
                      <div className="info-group">
                        <label>Serviço</label>
                        <p className="multiline">{agendamento.servico}</p>
                      </div>
                    </div>
                    
                    <div className="action-buttons">
                      <button
                        onClick={() => handleEdit(agendamento)}
                        className="btn-editar"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => confirmDelete(agendamento.id)}
                        className="btn-excluir"
                      >
                        Excluir
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="no-results">
            <i className="icon-calendar-empty"></i>
            <p>Nenhum agendamento encontrado</p>
            {telefone && (
              <button 
                onClick={() => setTelefone("")} 
                className="btn-limpar-filtro"
              >
                Limpar filtro
              </button>
            )}
          </div>
        )}

        {/* Modal de confirmação de exclusão */}
        {showDeleteModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-icon">
                <i className="icon-warning"></i>
              </div>
              <h3>Confirmar exclusão</h3>
              <p>Você tem certeza que deseja excluir este agendamento?</p>
              <div className="modal-buttons">
                <button 
                  onClick={() => setShowDeleteModal(false)} 
                  className="btn-cancel"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleConfirmDelete} 
                  className="btn-confirm"
                  disabled={loading}
                >
                  {loading ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgendamentosList;