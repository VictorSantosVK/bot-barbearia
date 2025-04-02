import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './CriarAgendamento.css';

const CriarAgendamento = () => {
  const [form, setForm] = useState({
    nome_cliente: '',
    telefone: '',
    data: '',
    horario: '',
    servico: ''
  });
  const [horariosDisponiveis, setHorariosDisponiveis] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erros, setErros] = useState({});
  const navigate = useNavigate();

  // Configuração do Axios para incluir credenciais em todas as requisições
  axios.interceptors.request.use(config => {
    const usuario = localStorage.getItem('usuario');
    const senha = localStorage.getItem('senha');
    
    if (usuario && senha) {
      config.headers['usuario'] = usuario;
      config.headers['senha'] = senha;
    }
    
    return config;
  }, error => {
    return Promise.reject(error);
  });

  useEffect(() => {
    if (form.data) {
      buscarHorariosDisponiveis(form.data);
    }
  }, [form.data]);

  const buscarHorariosDisponiveis = async (data) => {
    try {
      setLoading(true);
      
      const response = await axios.get(`http://localhost:3001/horarios-disponiveis?data=${data}`);
      
      if (response.data && response.data.horariosLivres) {
        setHorariosDisponiveis(response.data.horariosLivres);
        setErros(prev => ({ ...prev, horario: '' }));
      } else {
        throw new Error('Formato de resposta inválido');
      }
    } catch (error) {
      console.error('Erro ao buscar horários:', error);
      
      let mensagemErro = 'Erro ao buscar horários disponíveis';
      if (error.response) {
        if (error.response.status === 401) {
          mensagemErro = 'Acesso não autorizado - faça login novamente';
          localStorage.removeItem('usuario');
          localStorage.removeItem('senha');
          navigate('/login');
        } else if (error.response.data?.error) {
          mensagemErro = error.response.data.error;
        }
      }
      
      setErros(prev => ({ ...prev, horario: mensagemErro }));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (erros[name]) {
      setErros(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Verifica se há credenciais antes de continuar
    if (!localStorage.getItem('usuario') || !localStorage.getItem('senha')) {
      alert('Sessão expirada. Faça login novamente.');
      navigate('/login');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await axios.post('http://localhost:3001/agendamentos', form);
      
      alert('Agendamento criado com sucesso!');
      navigate('/agendamentos');
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      
      if (error.response) {
        // Tratamento para erro 401 (não autorizado)
        if (error.response.status === 401) {
          localStorage.removeItem('usuario');
          localStorage.removeItem('senha');
          alert('Sessão expirada. Faça login novamente.');
          navigate('/login');
          return;
        }
        
        // Tratamento para erros de validação
        if (error.response.data?.details) {
          const novosErros = {};
          error.response.data.details.forEach(err => {
            novosErros[err.param] = err.msg;
          });
          setErros(novosErros);
          
          const primeiroErro = error.response.data.details[0];
          alert(`Erro de validação: ${primeiroErro.msg}`);
        } else if (error.response.data?.error) {
          alert(`Erro: ${error.response.data.error}`);
        } else {
          alert('Erro ao criar agendamento');
        }
      } else {
        alert('Erro de conexão com o servidor');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='conteudo-principal'>
      <div className='criar-agendamento'>
        <h1>Novo Agendamento</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nome do Cliente:</label>
            <input
              type="text"
              name="nome_cliente"
              value={form.nome_cliente}
              onChange={handleChange}
              required
              className={erros.nome_cliente ? 'error' : ''}
            />
            {erros.nome_cliente && <span className="error-message">{erros.nome_cliente}</span>}
          </div>
          
          <div className="form-group">
            <label>Telefone:</label>
            <input
              type="text"
              name="telefone"
              value={form.telefone}
              onChange={handleChange}
              required
              className={erros.telefone ? 'error' : ''}
            />
            {erros.telefone && <span className="error-message">{erros.telefone}</span>}
          </div>
          
          <div className="form-group">
            <label>Data:</label>
            <input
              type="date"
              name="data"
              value={form.data}
              onChange={handleChange}
              min={new Date().toISOString().split('T')[0]}
              required
              className={erros.data ? 'error' : ''}
            />
            {erros.data && <span className="error-message">{erros.data}</span>}
          </div>
          
          <div className="form-group">
            <label>Horário:</label>
            {loading ? (
              <p>Carregando horários disponíveis...</p>
            ) : (
              <select
                name="horario"
                value={form.horario}
                onChange={handleChange}
                disabled={!form.data || loading}
                required
                className={erros.horario ? 'error' : ''}
              >
                <option value="">Selecione um horário</option>
                {horariosDisponiveis.map(horario => (
                  <option key={horario} value={horario}>{horario}</option>
                ))}
              </select>
            )}
            {erros.horario && <span className="error-message">{erros.horario}</span>}
          </div>
          
          <div className="form-group">
            <label>Serviço:</label>
            <input
              type="text"
              name="servico"
              value={form.servico}
              onChange={handleChange}
              required
              className={erros.servico ? 'error' : ''}
            />
            {erros.servico && <span className="error-message">{erros.servico}</span>}
          </div>
          
          <div className="form-actions">
            <button 
              type="submit" 
              className="btn-submit"
              disabled={loading || !form.data || !form.horario}
            >
              {loading ? 'Processando...' : 'Criar Agendamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CriarAgendamento;