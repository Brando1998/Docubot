<template>
  <div class="max-w-4xl mx-auto p-6">
    <h1 class="text-3xl font-bold text-gray-900 mb-8">Gestión de WhatsApp</h1>
    
    <!-- Card de Estado -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold text-gray-800">Estado de Conexión</h2>
          <span :class="statusBadgeClasses">
            <span :class="['w-2 h-2 rounded-full mr-2', statusDotClasses]"></span>
            {{ statusText }}
          </span>
        </div>
        
        <!-- Información adicional cuando está conectado -->
        <div v-if="whatsappData?.connected" class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <div class="flex items-center">
            <svg class="w-5 h-5 text-green-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
            <div>
              <p class="font-medium text-green-800">WhatsApp Conectado</p>
              <p v-if="whatsappData.user_name" class="text-sm text-green-600">Usuario: {{ whatsappData.user_name }}</p>
              <p v-if="whatsappData.phone_number" class="text-sm text-green-600">Número: {{ whatsappData.phone_number }}</p>
              <p v-if="whatsappData.last_connected" class="text-sm text-green-600">Última conexión: {{ formatDate(whatsappData.last_connected) }}</p>
            </div>
          </div>
        </div>

        <!-- Botones de acción -->
        <div class="flex flex-wrap gap-3">
          <!-- Botón principal (depende del estado) -->
          <button
            v-if="!whatsappData?.connected"
            @click="handleGenerateQR"
            :disabled="isLoading"
            class="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center"
          >
            <svg v-if="isLoading" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ isLoading ? 'Generando...' : 'Generar Código QR' }}
          </button>

          <!-- Refresh QR -->
          <button
            v-if="whatsappData?.qr_code && !whatsappData?.connected"
            @click="handleRefreshQR"
            :disabled="isLoading"
            class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Actualizar QR
          </button>

          <!-- 🆕 Reiniciar Sesión -->
          <button
            @click="handleRestartSession"
            :disabled="isLoading"
            class="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 disabled:opacity-50 flex items-center"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Reiniciar Sesión
          </button>

          <!-- 🆕 Limpiar Credenciales -->
          <button
            @click="handleClearSession"
            :disabled="isLoading"
            class="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            Limpiar Credenciales
          </button>

          <!-- Desconectar (solo si está conectado) -->
          <button
            v-if="whatsappData?.connected"
            @click="handleDisconnect"
            :disabled="isLoading"
            class="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728"/>
            </svg>
            Desconectar
          </button>

          <!-- 🆕 Estado Detallado -->
          <button
            @click="handleGetDetailedStatus"
            :disabled="isLoading"
            class="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 disabled:opacity-50 flex items-center"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            Ver Estado Detallado
          </button>
        </div>
      </div>
    </div>

    <!-- QR Code Display -->
    <div v-if="whatsappData?.qr_image && !whatsappData?.connected" class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      <div class="p-6 text-center">
        <h3 class="text-lg font-medium text-gray-800 mb-4">Escanea este código QR</h3>
        <div class="flex justify-center mb-4">
          <img :src="whatsappData.qr_image" alt="QR Code" class="max-w-xs" />
        </div>
        <p class="text-sm text-gray-600">
          Abre WhatsApp en tu teléfono, ve a Dispositivos vinculados y escanea este código
        </p>
      </div>
    </div>

    <!-- Estado Sin Conexión -->
    <div v-if="!whatsappData?.connected && !whatsappData?.qr_image" class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      <div class="p-6 text-center">
        <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-4">
          <svg class="h-6 w-6 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
          </svg>
        </div>
        <h4 class="text-lg font-medium text-gray-800 mb-2">WhatsApp Desconectado</h4>
        <p class="text-gray-600 text-sm mb-4">Genera un código QR para conectar WhatsApp</p>
      </div>
    </div>
    
    <!-- Mensajes de error/éxito -->
    <div v-if="uiMessage" :class="messageClasses" class="rounded-lg p-4 mb-4">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg v-if="uiMessageType === 'success'" class="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
          </svg>
          <svg v-else class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm font-medium">{{ uiMessage }}</p>
        </div>
      </div>
    </div>

    <!-- 🆕 Panel de Estado Detallado (opcional) -->
    <div v-if="detailedStatus" class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      <div class="p-6">
        <h3 class="text-lg font-medium text-gray-800 mb-4">Estado Detallado del Servicio</h3>
        <div class="bg-gray-50 rounded-lg p-4">
          <pre class="text-sm text-gray-600 whitespace-pre-wrap">{{ JSON.stringify(detailedStatus, null, 2) }}</pre>
        </div>
      </div>
    </div>

    <!-- Enlace a la página de Chats -->
    <div v-if="whatsappData?.connected" class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      <div class="p-6">
        <div class="text-center">
          <svg class="mx-auto h-12 w-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
          <h3 class="mt-2 text-lg font-medium text-gray-900">Gestión de Chats</h3>
          <p class="mt-1 text-sm text-gray-500">Administra tus conversaciones de WhatsApp</p>
          <router-link
            to="/dashboard/chats"
            class="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Ir a Chats
            <svg class="ml-2 -mr-1 w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useWhatsApp } from '@/composables/useWhatsApp'

// Usar el composable con todos los métodos
const {
  whatsappData,
  isLoading,
  error,
  fetchWhatsAppStatus,
  generateQR,
  refreshQR,
  disconnectWhatsApp,
  restartSession,      // 🆕 Nuevo método
  clearSession,        // 🆕 Nuevo método
  getDetailedStatus,   // 🆕 Nuevo método
  clearError
} = useWhatsApp()

// Estado para mensajes de UI
const uiMessage = ref('')
const uiMessageType = ref<'success' | 'error'>('success')
const detailedStatus = ref<any>(null)

// Estados computados
const statusText = computed(() => {
  if (!whatsappData.value) return 'Verificando...'
  if (whatsappData.value.connected) return 'Conectado'
  if (whatsappData.value.status === 'waiting_for_scan') return 'Esperando escaneo'
  if (whatsappData.value.status === 'initializing') return 'Inicializando'
  if (whatsappData.value.status === 'restarting') return 'Reiniciando'
  if (whatsappData.value.status === 'cleared') return 'Credenciales limpiadas'
  return 'Desconectado'
})

const statusBadgeClasses = computed(() => {
  const base = 'flex items-center px-3 py-1 rounded-full text-sm font-medium'
  if (!whatsappData.value) return `${base} bg-gray-100 text-gray-800`
  if (whatsappData.value.connected) return `${base} bg-green-100 text-green-800`
  if (whatsappData.value.status === 'waiting_for_scan') return `${base} bg-blue-100 text-blue-800`
  if (whatsappData.value.status === 'initializing') return `${base} bg-yellow-100 text-yellow-800`
  if (whatsappData.value.status === 'restarting') return `${base} bg-orange-100 text-orange-800`
  if (whatsappData.value.status === 'cleared') return `${base} bg-purple-100 text-purple-800`
  return `${base} bg-red-100 text-red-800`
})

const statusDotClasses = computed(() => {
  if (!whatsappData.value) return 'bg-gray-400'
  if (whatsappData.value.connected) return 'bg-green-400'
  if (whatsappData.value.status === 'waiting_for_scan') return 'bg-blue-400'
  if (whatsappData.value.status === 'initializing') return 'bg-yellow-400'
  if (whatsappData.value.status === 'restarting') return 'bg-orange-400'
  if (whatsappData.value.status === 'cleared') return 'bg-purple-400'
  return 'bg-red-400'
})

const messageClasses = computed(() => {
  const base = 'border'
  if (uiMessageType.value === 'success') return `${base} bg-green-50 border-green-200`
  return `${base} bg-red-50 border-red-200`
})

// Handlers existentes
const handleGenerateQR = async () => {
  try {
    await generateQR()
    showMessage('QR generado correctamente', 'success')
  } catch (err: any) {
    showMessage(error.value || 'Error generando QR', 'error')
  }
}

const handleRefreshQR = async () => {
  try {
    await refreshQR()
    showMessage('QR actualizado', 'success')
  } catch (err: any) {
    showMessage(error.value || 'Error actualizando QR', 'error')
  }
}

const handleDisconnect = async () => {
  try {
    await disconnectWhatsApp()
    showMessage('WhatsApp desconectado correctamente', 'success')
  } catch (err: any) {
    showMessage(error.value || 'Error desconectando', 'error')
  }
}

// 🆕 Nuevos handlers
const handleRestartSession = async () => {
  try {
    await restartSession()
    showMessage('Sesión reiniciada correctamente', 'success')
    // Actualizar estado después de un momento
    setTimeout(fetchWhatsAppStatus, 3000)
  } catch (err: any) {
    showMessage(error.value || 'Error reiniciando sesión', 'error')
  }
}

const handleClearSession = async () => {
  try {
    // Confirmación antes de limpiar credenciales
    if (confirm('¿Estás seguro de que quieres limpiar las credenciales? Esto eliminará la sesión actual.')) {
      await clearSession()
      showMessage('Credenciales limpiadas correctamente', 'success')
      // Limpiar también el estado detallado
      detailedStatus.value = null
    }
  } catch (err: any) {
    showMessage(error.value || 'Error limpiando credenciales', 'error')
  }
}

const handleGetDetailedStatus = async () => {
  try {
    const status = await getDetailedStatus()
    detailedStatus.value = status
    showMessage('Estado detallado cargado', 'success')
  } catch (err: any) {
    showMessage(error.value || 'Error obteniendo estado detallado', 'error')
  }
}


// Utilidades
const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
  uiMessage.value = text
  uiMessageType.value = type
  setTimeout(clearMessage, 5000)
}

const clearMessage = () => {
  uiMessage.value = ''
  clearError()
}

const formatDate = (dateString: string) => {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    return date.toLocaleString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (error) {
    return dateString
  }
}


// Polling para actualizar estado automáticamente
let statusInterval: number | null = null

onMounted(async () => {
  await fetchWhatsAppStatus()
  
  // Actualizar estado cada 10 segundos
  statusInterval = setInterval(async () => {
    try {
      await fetchWhatsAppStatus()
    } catch (err) {
      // Error silencioso en polling
    }
  }, 10000)
})

onUnmounted(() => {
  if (statusInterval) {
    clearInterval(statusInterval)
  }
})
</script>