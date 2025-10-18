<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">Gestión de Bots</h1>
          <p class="text-gray-600 mt-1">Crea y administra instancias de bots Rasa</p>
        </div>
        <button
          @click="showCreateForm = !showCreateForm"
          class="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Nuevo Bot
        </button>
      </div>
    </div>

    <!-- Formulario de creación (colapsable) -->
    <div v-if="showCreateForm" class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-800">Crear Nuevo Bot</h2>
        <button @click="showCreateForm = false" class="text-gray-400 hover:text-gray-600">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <form @submit.prevent="createBot" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Nombre del Bot *
          </label>
          <input
            v-model="newBot.name"
            type="text"
            placeholder="Ej: bot_ventas, bot_soporte"
            required
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p class="text-xs text-gray-500 mt-1">Nombre único para identificar el bot</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Número de WhatsApp
            <span class="text-gray-400 font-normal">(Opcional)</span>
          </label>
          <input
            v-model="newBot.whatsapp_number"
            type="text"
            placeholder="Ej: 573001234567"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p class="text-xs text-gray-500 mt-1">
            📱 Asocia un número de WhatsApp para enrutar mensajes a este bot específico.
            Puedes dejarlo vacío y configurarlo después.
          </p>
        </div>

        <div class="flex items-center gap-3 pt-4">
          <button
            type="submit"
            :disabled="isLoading"
            class="flex items-center px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg v-if="isLoading" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ isLoading ? 'Creando...' : 'Crear Bot' }}
          </button>
          <button
            type="button"
            @click="cancelCreate"
            class="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>

    <!-- Mensaje de feedback -->
    <div
      v-if="message"
      :class="[
        'p-4 rounded-lg border',
        messageType === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
      ]"
    >
      <div class="flex items-center">
        <svg v-if="messageType === 'success'" class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
        </svg>
        <svg v-else class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
        </svg>
        {{ message }}
      </div>
    </div>

    <!-- Lista de bots -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200">
      <div class="p-6 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-800">Bots Activos</h2>
        <p class="text-sm text-gray-600 mt-1">{{ bots.length }} instancia{{ bots.length !== 1 ? 's' : '' }} en ejecución</p>
      </div>

      <!-- Tabla de bots -->
      <div v-if="bots.length > 0" class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nombre
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Puerto
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                WhatsApp
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Creado
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="bot in bots" :key="bot.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-blue-100 rounded-lg">
                    <svg class="h-6 w-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                    </svg>
                  </div>
                  <div class="ml-4">
                    <div class="text-sm font-medium text-gray-900">{{ bot.name }}</div>
                    <div class="text-sm text-gray-500">ID: {{ bot.id }}</div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-sm font-mono text-gray-900">{{ bot.port }}</span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="[
                  'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                  bot.status === 'running' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                ]">
                  {{ bot.status === 'running' ? '● En línea' : '○ Detenido' }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ bot.whatsapp_number || '—' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ formatDate(bot.created_at) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button
                  @click="confirmDelete(bot)"
                  class="text-red-600 hover:text-red-900 transition-colors"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Estado vacío -->
      <div v-else class="p-12 text-center">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900">No hay bots creados</h3>
        <p class="mt-1 text-sm text-gray-500">Comienza creando tu primer bot personalizado</p>
        <button
          @click="showCreateForm = true"
          class="mt-4 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Crear Bot
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useBots } from '@/composables/useBots'

const { bots, isLoading, error, fetchBots, createBot: createBotAPI, deleteBot: deleteBotAPI } = useBots()

const showCreateForm = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')

const newBot = ref({
  name: '',
  based_on_bot_id: 1,
  whatsapp_number: ''
})

onMounted(() => {
  loadBots()
})

async function loadBots() {
  try {
    await fetchBots()
    if (error.value) {
      showMessage(error.value, 'error')
    }
  } catch (err) {
    showMessage('Error cargando bots', 'error')
  }
}

async function createBot() {
  try {
    await createBotAPI(newBot.value)
    showMessage('Bot creado exitosamente', 'success')
    newBot.value = { name: '', based_on_bot_id: 1, whatsapp_number: '' }
    showCreateForm.value = false
  } catch (err) {
    showMessage('Error creando bot', 'error')
  }
}

function confirmDelete(bot: any) {
  if (confirm(`¿Estás seguro de eliminar el bot "${bot.name}"?\n\nEsto detendrá y eliminará el contenedor de Docker.`)) {
    deleteBot(bot.id)
  }
}

async function deleteBot(id: number) {
  try {
    await deleteBotAPI(id)
    showMessage('Bot eliminado exitosamente', 'success')
  } catch (err) {
    showMessage('Error eliminando bot', 'error')
  }
}

function cancelCreate() {
  showCreateForm.value = false
  newBot.value = { name: '', based_on_bot_id: 1, whatsapp_number: '' }
}

function showMessage(msg: string, type: 'success' | 'error') {
  message.value = msg
  messageType.value = type
  setTimeout(() => {
    message.value = ''
  }, 5000)
}

function formatDate(dateString: string) {
  if (!dateString) return '—'
  const date = new Date(dateString)
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}
</script>