// src/composables/useWhatsApp.ts
import { ref } from 'vue'
import api from '@/services/api'

interface WhatsAppStatus {
  status: string
  connected: boolean
  qr_code?: string
  qr_image?: string
  message?: string
  reconnect_attempts?: number
  phone_number?: string
  user_name?: string
  last_connected?: string
}

export function useWhatsApp() {
  const whatsappData = ref<WhatsAppStatus | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const clearError = () => {
    error.value = null
  }

  const fetchWhatsAppStatus = async () => {
    try {
      isLoading.value = true
      clearError()
      
      const response = await api.get('/api/v1/whatsapp/qr')
      whatsappData.value = response.data
      
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || 'Error obteniendo estado'
      console.error('Error fetching WhatsApp status:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const generateQR = async () => {
    try {
      isLoading.value = true
      clearError()
      
      // Primero intentar obtener el estado/QR
      await fetchWhatsAppStatus()
      
      // Si no está generando, forzar restart
      if (whatsappData.value?.status !== 'waiting_for_scan' && whatsappData.value?.status !== 'initializing') {
        console.log('🔄 Forzando restart para generar QR...')
        await restartSession()
        
        // Esperar un momento y volver a verificar
        setTimeout(fetchWhatsAppStatus, 2000)
      }
      
      return whatsappData.value
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || 'Error generando QR'
      console.error('Error generating QR:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const refreshQR = async () => {
    try {
      isLoading.value = true
      clearError()
      
      // Restart para generar nuevo QR
      await restartSession()
      
      // Esperar y actualizar estado
      setTimeout(fetchWhatsAppStatus, 2000)
      
      return whatsappData.value
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || 'Error actualizando QR'
      console.error('Error refreshing QR:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const disconnectWhatsApp = async () => {
    try {
      isLoading.value = true
      clearError()
      
      const response = await api.post('/api/v1/whatsapp/disconnect')
      whatsappData.value = { connected: false, status: 'disconnected' }
      
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || 'Error desconectando'
      console.error('Error disconnecting WhatsApp:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // 🆕 Nuevo método: Reiniciar sesión completa
  const restartSession = async () => {
    try {
      isLoading.value = true
      clearError()
      
      const response = await api.post('/api/v1/whatsapp/restart')
      
      // Actualizar estado local
      whatsappData.value = { 
        connected: false, 
        status: 'restarting',
        message: 'Reiniciando sesión...'
      }
      
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || 'Error reiniciando sesión'
      console.error('Error restarting session:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // 🆕 Nuevo método: Limpiar credenciales
  const clearSession = async () => {
    try {
      isLoading.value = true
      clearError()
      
      const response = await api.post('/api/v1/whatsapp/clear-session')
      
      // Resetear estado local
      whatsappData.value = { 
        connected: false, 
        status: 'cleared',
        message: 'Credenciales limpiadas'
      }
      
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || 'Error limpiando credenciales'
      console.error('Error clearing session:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // 🆕 Nuevo método: Obtener estado detallado
  const getDetailedStatus = async () => {
    try {
      isLoading.value = true
      clearError()
      
      const response = await api.get('/api/v1/whatsapp/status')
      
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || 'Error obteniendo estado detallado'
      console.error('Error getting detailed status:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const sendMessage = async (number: string, message: string) => {
    try {
      isLoading.value = true
      clearError()
      
      const response = await api.post('/api/v1/whatsapp/send', {
        to: number,  // Cambié de 'number' a 'to' para coincidir con la API
        message
      })
      
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || 'Error enviando mensaje'
      console.error('Error sending message:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  return {
    // Estado
    whatsappData,
    isLoading,
    error,
    
    // Métodos existentes
    fetchWhatsAppStatus,
    generateQR,
    refreshQR,
    disconnectWhatsApp,
    sendMessage,
    clearError,
    restartSession,
    clearSession,
    getDetailedStatus
  }
}