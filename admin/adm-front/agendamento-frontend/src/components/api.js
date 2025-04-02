import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001',
  withCredentials: true, // OBRIGATÓRIO para cookies de sessão
});

// Adiciona tratamento para erros de autenticação
api.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401) {
    // Redireciona para login se não autorizado
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }
  return Promise.reject(error);
});

export default api;