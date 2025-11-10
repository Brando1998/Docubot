import { ref, computed } from "vue";
import api from "../services/api";

// ✅ LIMPIO: Solo token, datos del usuario se obtienen cuando se necesiten
const accessToken = ref<string | null>(localStorage.getItem("accessToken"));
const currentUser = ref<{
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  last_login?: string;
} | null>(null);

// Estados computados
const isAuthenticated = computed(() => !!accessToken.value);
const userRole = computed(() => currentUser.value?.role || null);
const userEmail = computed(() => currentUser.value?.email || null);
const userId = computed(() => currentUser.value?.id || null);
const username = computed(() => currentUser.value?.username || null);

export function useAuth() {
  const login = async (username: string, password: string) => {
    try {
      const res = await api.post("/auth/login", { username, password });

      // ✅ LIMPIO: Solo guardar el token
      accessToken.value = res.data.access_token;

      if (accessToken.value) {
        localStorage.setItem("accessToken", accessToken.value);
      }

      // ✅ OPCIONAL: Cargar datos del usuario inmediatamente
      await getCurrentUser();

      return res.data;
    } catch (error) {
      console.error("Error en login:", error);
      throw error;
    }
  };

  const logout = () => {
    accessToken.value = null;
    currentUser.value = null;
    localStorage.removeItem("accessToken");
  };

  const refreshTokenFn = async () => {
    if (!accessToken.value) throw new Error("No hay token para refrescar");

    try {
      const res = await api.post(
        "/auth/refresh",
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken.value}`,
          },
        }
      );

      accessToken.value = res.data.access_token;

      if (accessToken.value) {
        localStorage.setItem("accessToken", accessToken.value);
      }

      return res.data;
    } catch (error) {
      logout();
      throw error;
    }
  };

  // ✅ PRINCIPAL: Obtener datos actualizados del usuario desde el servidor
  const getCurrentUser = async () => {
    if (!accessToken.value) return null;

    try {
      // ✅ NUEVO ENDPOINT: /auth/me en lugar de /api/v1/users/me
      const res = await api.get("/auth/me");

      currentUser.value = {
        id: res.data.id,
        username: res.data.username,
        email: res.data.email,
        role: res.data.role,
        is_active: res.data.is_active,
        last_login: res.data.last_login,
      };

      return currentUser.value;
    } catch (error: any) {
      console.error("Error obteniendo usuario actual:", error);
      // Si falla, es posible que el token sea inválido
      if (error.response?.status === 401) {
        logout();
      }
      return null;
    }
  };

  // ✅ NUEVO: Cargar usuario si no está cargado
  const ensureUserLoaded = async () => {
    if (!currentUser.value && accessToken.value) {
      await getCurrentUser();
    }
    return currentUser.value;
  };

  // Funciones de verificación de roles
  const hasRole = (role: string) => {
    return userRole.value === role;
  };

  const hasAnyRole = (roles: string[]) => {
    return roles.includes(userRole.value || "");
  };

  // ✅ NUEVO: Verificar si el usuario está activo
  const isUserActive = computed(() => {
    return currentUser.value?.is_active === true;
  });

  return {
    // Estados
    accessToken,
    currentUser,
    isAuthenticated,
    isUserActive,

    // Datos computados del usuario
    userRole,
    userEmail,
    userId,
    username,

    // Funciones
    login,
    logout,
    refreshTokenFn,
    getCurrentUser,
    ensureUserLoaded,
    hasRole,
    hasAnyRole,
  };
}
