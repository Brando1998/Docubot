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
    <div v-if="message" :class="messageClasses" class="rounded-lg p-4 mb-4">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg v-if="messageType === 'success'" class="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
          </svg>
          <svg v-else class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm font-medium">{{ message }}</p>
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

    <!-- 🆕 Panel de Gestión de Chats -->
    <div v-if="whatsappData?.connected" class="bg-white rounded-lg shadow-sm border border-gray-200">
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-gray-800">Gestión de Chats</h2>
          <button
            @click="loadChats"
            :disabled="isLoading"
            class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center"
          >
            <svg v-if="isLoading" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <svg v-else class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            {{ isLoading ? 'Cargando...' : 'Actualizar Chats' }}
          </button>
        </div>

        <!-- Barra de búsqueda y filtros -->
        <div class="mb-4 flex flex-wrap gap-3">
          <div class="flex-1 min-w-64">
            <input
              v-model="chatSearch"
              @input="filterChats"
              placeholder="Buscar chats..."
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            v-model="chatFilter"
            @change="filterChats"
            class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Todos los chats</option>
            <option value="bot">Modo Bot</option>
            <option value="user">Modo Usuario</option>
            <option value="unread">Con mensajes sin leer</option>
          </select>
        </div>

        <!-- Lista de Chats -->
        <div v-if="filteredChats.length > 0" class="space-y-3">
          <div
            v-for="chat in filteredChats"
            :key="chat.id"
            @click="selectChat(chat)"
            :class="[
              'p-4 rounded-lg border cursor-pointer transition-colors',
              selectedChat?.id === chat.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
            ]"
          >
            <div class="flex items-center justify-between">
              <div class="flex-1">
                <div class="flex items-center">
                  <h4 class="font-medium text-gray-900">{{ chat.name }}</h4>
                  <span v-if="chat.isGroup" class="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                    Grupo
                  </span>
                  <span v-if="chat.unreadCount > 0" class="ml-2 px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                    {{ chat.unreadCount }} sin leer
                  </span>
                </div>
                <p v-if="chat.lastMessage" class="text-sm text-gray-600 mt-1 truncate">
                  {{ chat.lastMessage.text }}
                </p>
                <p class="text-xs text-gray-500 mt-1">
                  {{ formatChatDate(chat.lastMessage?.timestamp) }}
                </p>
              </div>
              <div class="flex items-center space-x-2">
                <!-- Toggle para modo chatbot/usuario -->
                <div class="flex items-center">
                  <span class="text-xs text-gray-500 mr-2">Bot</span>
                  <button
                    @click.stop="toggleChatMode(chat)"
                    :class="[
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                      chat.botMode ? 'bg-green-600' : 'bg-gray-200'
                    ]"
                  >
                    <span
                      :class="[
                        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                        chat.botMode ? 'translate-x-6' : 'translate-x-1'
                      ]"
                    />
                  </button>
                  <span class="text-xs text-gray-500 ml-2">Usuario</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Sin chats -->
        <div v-else-if="!isLoading" class="text-center py-8">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">No hay chats disponibles</h3>
          <p class="mt-1 text-sm text-gray-500">Los chats aparecerán aquí cuando WhatsApp esté conectado</p>
        </div>
      </div>
    </div>

    <!-- 🆕 Panel de Chat Seleccionado -->
    <div v-if="selectedChat" class="bg-white rounded-lg shadow-sm border border-gray-200">
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center">
            <h3 class="text-lg font-semibold text-gray-800">{{ selectedChat.name }}</h3>
            <span v-if="selectedChat.isGroup" class="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
              Grupo
            </span>
            <span :class="[
              'ml-2 px-2 py-1 text-xs rounded-full',
              selectedChat.botMode ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
            ]">
              {{ selectedChat.botMode ? 'Modo Bot' : 'Modo Usuario' }}
            </span>
          </div>
          <div class="flex space-x-2">
            <button
              @click="exportChat"
              :disabled="isLoading"
              class="text-blue-500 hover:text-blue-700 disabled:opacity-50"
              title="Exportar conversación"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </button>
            <button
              @click="archiveSelectedChat"
              :disabled="isLoading"
              class="text-orange-500 hover:text-orange-700 disabled:opacity-50"
              title="Archivar chat"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
              </svg>
            </button>
            <button
              @click="closeChat"
              class="text-gray-400 hover:text-gray-600"
              title="Cerrar chat"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Área de Mensajes -->
        <div class="bg-gray-50 rounded-lg p-4 mb-4 h-96 overflow-y-auto" ref="messagesContainer">
          <div v-if="chatMessages.length === 0" class="text-center text-gray-500 py-8">
            No hay mensajes para mostrar
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="message in chatMessages"
              :key="message.id"
              :class="[
                'flex',
                message.fromMe ? 'justify-end' : 'justify-start'
              ]"
            >
              <div
                :class="[
                  'max-w-xs lg:max-w-md px-4 py-2 rounded-lg',
                  message.fromMe
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-800 border border-gray-200'
                ]"
              >
                <p class="text-sm">{{ message.text }}</p>
                <p :class="[
                  'text-xs mt-1',
                  message.fromMe ? 'text-blue-100' : 'text-gray-500'
                ]">
                  {{ formatMessageDate(message.timestamp) }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Input para enviar mensajes -->
        <div class="flex space-x-3">
          <input
            v-model="newMessage"
            @keyup.enter="sendMessage"
            placeholder="Escribe un mensaje..."
            class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            :disabled="isLoading"
          />
          <button
            @click="sendMessage"
            :disabled="!newMessage.trim() || isLoading"
            class="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <svg v-if="isLoading" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <svg v-else class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
            </svg>
            {{ isLoading ? 'Enviando...' : 'Enviar' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
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
  clearError,
  getChats,           // 🆕 Nuevo método para chats
  getChatMessages,    // 🆕 Nuevo método para mensajes
  sendChatMessage     // 🆕 Nuevo método para enviar mensajes
} = useWhatsApp()

// 🆕 Estado para gestión de chats
const chats = ref<any[]>([])
const filteredChats = ref<any[]>([])
const selectedChat = ref<any>(null)
const chatMessages = ref<any[]>([])
const newMessage = ref('')
const messagesContainer = ref<HTMLElement>()
const chatSearch = ref('')
const chatFilter = ref('all')

// Estado para mensajes de UI
const message = ref('')
const messageType = ref<'success' | 'error'>('success')
const detailedStatus = ref<any>(null) // 🆕 Para mostrar estado detallado

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
  if (messageType.value === 'success') return `${base} bg-green-50 border-green-200`
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

// 🆕 Funciones para gestión de chats
const loadChats = async () => {
  try {
    const data = await getChats()
    chats.value = data.chats || []
    // Inicializar modo bot por defecto y cargar modos desde BD
    for (const chat of chats.value) {
      if (chat.botMode === undefined) {
        chat.botMode = true // Por defecto en modo bot
      }
      // TODO: Cargar modo desde BD cuando esté implementado
      // try {
      //   const modeData = await getChatModeFromDB(chat.id)
      //   if (modeData) {
      //     chat.botMode = modeData.bot_mode
      //   }
      // } catch (err) {
      //   // Si no hay modo guardado, mantener el por defecto
      // }
    }
    filterChats() // Aplicar filtros iniciales
    showMessage('Chats cargados correctamente', 'success')
  } catch (err: any) {
    showMessage('Error cargando chats', 'error')
    console.error('Error loading chats:', err)
  }
}

// TODO: Implementar función para obtener modo del chat desde BD
// const getChatModeFromDB = async (chatId: string) => {
//   try {
//     // Aquí iría la llamada a la API para obtener el modo del chat
//     return null
//   } catch (err) {
//     return null
//   }
// }

const filterChats = () => {
  let filtered = [...chats.value]

  // Filtro de búsqueda
  if (chatSearch.value.trim()) {
    const searchTerm = chatSearch.value.toLowerCase()
    filtered = filtered.filter(chat =>
      chat.name.toLowerCase().includes(searchTerm) ||
      (chat.lastMessage?.text && chat.lastMessage.text.toLowerCase().includes(searchTerm))
    )
  }

  // Filtro por modo
  if (chatFilter.value !== 'all') {
    switch (chatFilter.value) {
      case 'bot':
        filtered = filtered.filter(chat => chat.botMode)
        break
      case 'user':
        filtered = filtered.filter(chat => !chat.botMode)
        break
      case 'unread':
        filtered = filtered.filter(chat => chat.unreadCount > 0)
        break
    }
  }

  filteredChats.value = filtered
}

const selectChat = async (chat: any) => {
  selectedChat.value = chat
  await loadChatMessages(chat.id)
}

const loadChatMessages = async (chatId: string) => {
  try {
    const data = await getChatMessages(chatId)
    chatMessages.value = data.messages || []
    await nextTick()
    scrollToBottom()
  } catch (err: any) {
    showMessage('Error cargando mensajes', 'error')
    console.error('Error loading messages:', err)
  }
}

const toggleChatMode = async (chat: any) => {
  const newMode = !chat.botMode
  try {
    // TODO: Implementar persistencia en BD
    chat.botMode = newMode
    showMessage(`Modo ${newMode ? 'bot' : 'usuario'} activado para ${chat.name}`, 'success')
  } catch (err: any) {
    showMessage('Error actualizando modo de chat', 'error')
    console.error('Error updating chat mode:', err)
  }
}

const sendMessage = async () => {
  if (!newMessage.value.trim() || !selectedChat.value) return

  try {
    await sendChatMessage(selectedChat.value.id, newMessage.value.trim())

    // Agregar mensaje a la lista local
    const message = {
      id: Date.now().toString(),
      text: newMessage.value.trim(),
      fromMe: true,
      timestamp: Date.now() / 1000
    }
    chatMessages.value.push(message)
    newMessage.value = ''
    await nextTick()
    scrollToBottom()
    showMessage('Mensaje enviado', 'success')
  } catch (err: any) {
    showMessage('Error enviando mensaje', 'error')
    console.error('Error sending message:', err)
  }
}

const closeChat = () => {
  selectedChat.value = null
  chatMessages.value = []
}

const archiveSelectedChat = async () => {
  if (!selectedChat.value) return

  try {
    // Simular archivado por ahora
    showMessage(`Chat "${selectedChat.value.name}" archivado correctamente`, 'success')
    // Remover de la lista de chats
    chats.value = chats.value.filter(chat => chat.id !== selectedChat.value.id)
    closeChat()
  } catch (err: any) {
    showMessage('Error archivando chat', 'error')
    console.error('Error archiving chat:', err)
  }
}

const exportChat = async () => {
  if (!selectedChat.value) return

  try {
    // Simular exportación por ahora
    const conversationText = chatMessages.value.map((msg: any) =>
      `${formatMessageDate(msg.timestamp)} ${msg.fromMe ? 'Tú' : 'Cliente'}: ${msg.text || msg.message}`
    ).join('\n')

    // Descargar archivo
    const blob = new Blob([conversationText], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat_${selectedChat.value.name}_${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)

    showMessage('Conversación exportada correctamente', 'success')
  } catch (err: any) {
    showMessage('Error exportando conversación', 'error')
    console.error('Error exporting conversation:', err)
  }
}

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// Utilidades
const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
  message.value = text
  messageType.value = type
  setTimeout(clearMessage, 5000)
}

const clearMessage = () => {
  message.value = ''
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

const formatChatDate = (timestamp?: number) => {
  if (!timestamp) return ''
  try {
    const date = new Date(timestamp * 1000)
    return date.toLocaleString('es-CO', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (error) {
    return ''
  }
}

const formatMessageDate = (timestamp?: number) => {
  if (!timestamp) return ''
  try {
    const date = new Date(timestamp * 1000)
    return date.toLocaleString('es-CO', {
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (error) {
    return ''
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