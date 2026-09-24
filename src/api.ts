import axios from 'axios';

const api = axios.create({
  baseURL: '', // Proxied via Vite
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('drive_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('drive_token');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default api;
