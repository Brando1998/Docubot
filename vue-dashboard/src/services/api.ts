import axios, { AxiosError } from "axios";
import { useAuth } from "../composables/useAuth";

// Function to get API base URL
const getApiBaseUrl = () => {
  // Check if VITE_API_URL is set
  const envApiUrl = import.meta.env.VITE_API_URL;

  if (envApiUrl && envApiUrl !== "auto") {
    return envApiUrl;
  }

  // Auto-detect from current domain
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol;
    const host = window.location.host;
    return `${protocol}//${host}:8080`;
  }

  // Fallback for SSR or build time
  return "http://13.59.238.219:8080";
};

const api = axios.create({
  baseURL: getApiBaseUrl() + "/api", // Environment-based API URL
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
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    // ✅ NO intentar refresh en rutas de auth
    if (
      originalRequest?.url?.includes("/auth/login") ||
      originalRequest?.url?.includes("/auth/refresh")
    ) {
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
        console.error(
          "Token refresh failed, redirecting to login",
          refreshError
        );

        // Clear auth state first
        logout();

        // Redirect to login using window location
        if (typeof window !== "undefined") {
          // Force a complete page reload to ensure clean state
          window.location.href = "/login";
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
