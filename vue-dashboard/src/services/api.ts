import axios from "axios";
import { useAuth } from "../composables/useAuth";

const api = axios.create({
  baseURL: "/api",  // Usar el proxy de nginx
});

api.interceptors.request.use(
  (config) => {
    const { accessToken } = useAuth();
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
    
    // ✅ NO intentar refresh en rutas de auth
    if (originalRequest.url?.includes('/auth/login') || 
        originalRequest.url?.includes('/auth/refresh')) {
      return Promise.reject(error);
    }
    
    // ✅ Solo hacer refresh si hay 401 y no es un retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const { refreshTokenFn, logout } = useAuth();
      
      try {
        await refreshTokenFn();
        
        const { accessToken } = useAuth();
        if (accessToken.value) {
          originalRequest.headers.Authorization = `Bearer ${accessToken.value}`;
        }
        
        return api(originalRequest);
      } catch (refreshError) {
        console.error("Refresh token failed", refreshError);
        logout();
        
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