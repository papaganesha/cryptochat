import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000', // Coloque a URL do seu backend
});

// Interceptor para enviar o token em cada requisição
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('@App:token');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
});

// Interceptor para lidar com erro 401 (token expirado)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Se o token expirar, limpa a sessão e desloga o usuário
      sessionStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
