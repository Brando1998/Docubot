import axios from "axios";
import { useAuth } from "../composables/useAuth";

const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use(
  (config) => {
    const { accessToken } = useAuth();
    // ✅ CORREGIR: Verificar que el token no sea null
    if (accessToken.value) {
      config.headers.Authorization = `Bearer ${accessToken.value}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // ✅ CORREGIR: Verificar 401 y evitar bucle infinito
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const { refreshTokenFn, logout } = useAuth();
      
      try {
        await refreshTokenFn();
        
        // ✅ NUEVO: Obtener el token actualizado
        const { accessToken } = useAuth();
        if (accessToken.value) {
          originalRequest.headers.Authorization = `Bearer ${accessToken.value}`;
        }
        
        return api(originalRequest);
      } catch (refreshError) {
        console.error("Refresh token failed", refreshError);
        logout(); // Hacer logout si el refresh falla
        
        // ✅ OPCIONAL: Redirigir al login
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;