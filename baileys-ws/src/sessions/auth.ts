// src/sessions/auth.ts
import { useMultiFileAuthState } from "@whiskeysockets/baileys";

/**
 * Obtiene el estado de autenticación usando múltiples archivos para una sesión específica.
 * @param sessionId - ID de la sesión (opcional, por defecto "default")
 * @returns {Promise<ReturnType<typeof useMultiFileAuthState>>} El estado de autenticación.
 */
export const getAuthState = async (sessionId: string = "default") => {
  const authPath = `auth/${sessionId}`;
  const authState = await useMultiFileAuthState(authPath);
  return authState;
};

/**
 * Limpia las credenciales de autenticación de una sesión específica.
 * @param sessionId - ID de la sesión a limpiar
 */
export const clearAuthState = async (sessionId: string): Promise<void> => {
  try {
    console.log(`🧹 Limpiando credenciales de sesión: ${sessionId}`);
    
    // Importar módulos de manera dinámica
    const { existsSync, readdirSync, unlinkSync } = await import('fs');
    const { join } = await import('path');
    
    const authPath = `./auth/${sessionId}`;
    
    if (existsSync(authPath)) {
      try {
        const files = readdirSync(authPath);
        for (const file of files) {
          const filePath = join(authPath, file);
          try {
            unlinkSync(filePath);
            console.log(`🗑️ Eliminado: ${filePath}`);
          } catch (e) {
            console.log(`⚠️ No se pudo eliminar ${filePath}:`, e);
          }
        }
      } catch (e) {
        console.log(`⚠️ Error leyendo directorio ${authPath}:`, e);
      }
    }
    
    console.log(`✅ Credenciales de ${sessionId} limpiadas exitosamente`);
  } catch (error) {
    console.error(`❌ Error limpiando credenciales de ${sessionId}:`, error);
  }
};
