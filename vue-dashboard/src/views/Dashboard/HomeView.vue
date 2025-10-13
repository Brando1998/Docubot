<template>
  <div class="space-y-6">
    <!-- Header con filtros de fecha -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold text-gray-800">Dashboard de Estadísticas</h2>
          <p class="text-gray-600 mt-1">Métricas del chatbot y uso del sistema</p>
        </div>

        <!-- Filtros de fecha -->
        <div class="flex flex-col sm:flex-row gap-3">
          <select
            v-model="selectedPeriod"
            @change="loadStats"
            class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="day">Hoy</option>
            <option value="month">Este Mes</option>
            <option value="year">Este Año</option>
            <option value="custom">Rango Personalizado</option>
          </select>

          <div v-if="selectedPeriod === 'custom'" class="flex gap-2">
            <input
              v-model="startDate"
              type="date"
              @change="loadStats"
              class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              v-model="endDate"
              type="date"
              @change="loadStats"
              class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            @click="loadStats"
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
            Actualizar
          </button>
        </div>
      </div>
    </div>

    <!-- Estadísticas principales -->
    <div v-if="stats" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <!-- Total de Clientes -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-blue-100">
            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Total Clientes</p>
            <p class="text-2xl font-bold text-gray-900">{{ stats.clients?.total || 0 }}</p>
            <p class="text-sm text-green-600">+{{ stats.clients?.new || 0 }} nuevos</p>
          </div>
        </div>
      </div>

      <!-- Documentos Generados -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-green-100">
            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Documentos</p>
            <p class="text-2xl font-bold text-gray-900">{{ stats.documents?.total || 0 }}</p>
            <p class="text-sm text-green-600">+{{ stats.documents?.generated || 0 }} generados</p>
          </div>
        </div>
      </div>

      <!-- Mensajes Totales -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-purple-100">
            <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Mensajes</p>
            <p class="text-2xl font-bold text-gray-900">{{ stats.conversations?.total_messages || 0 }}</p>
            <p class="text-sm text-blue-600">{{ stats.conversations?.messages_in_period || 0 }} en período</p>
          </div>
        </div>
      </div>

      <!-- Chats Activos -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-orange-100">
            <svg class="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Chats Activos</p>
            <p class="text-2xl font-bold text-gray-900">{{ stats.conversations?.active_conversations || 0 }}</p>
            <p class="text-sm text-gray-500">{{ stats.chatbot?.bot_mode_chats || 0 }} en modo bot</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Gráficos y detalles -->
    <div v-if="stats" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Documentos por tipo -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">Documentos por Tipo</h3>
        <div v-if="stats.documents?.by_type" class="space-y-3">
          <div v-for="[type, count] in Object.entries(stats.documents.by_type)" :key="type"
               class="flex items-center justify-between">
            <span class="text-sm text-gray-600 capitalize">{{ type }}</span>
            <div class="flex items-center">
              <div class="w-24 bg-gray-200 rounded-full h-2 mr-3">
                <div class="bg-blue-500 h-2 rounded-full"
                     :style="{ width: getPercentage(count, stats.documents.total) + '%' }"></div>
              </div>
              <span class="text-sm font-medium text-gray-900">{{ count }}</span>
            </div>
          </div>
        </div>
        <div v-else class="text-center text-gray-500 py-8">
          No hay datos de documentos por tipo
        </div>
      </div>

      <!-- Estado del Chatbot -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">Estado del Chatbot</h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Chats en Modo Bot</span>
            <span class="text-sm font-medium text-green-600">{{ stats.chatbot?.bot_mode_chats || 0 }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Chats en Modo Manual</span>
            <span class="text-sm font-medium text-blue-600">{{ stats.chatbot?.manual_mode_chats || 0 }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Chats Archivados</span>
            <span class="text-sm font-medium text-orange-600">{{ stats.chatbot?.archived_chats || 0 }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Tasa de Éxito de Formularios</span>
            <span class="text-sm font-medium text-purple-600">{{ ((stats.chatbot?.form_success_rate || 0) * 100).toFixed(1) }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Documentos recientes -->
    <div v-if="stats?.documents?.recent_documents?.length" class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 class="text-lg font-semibold text-gray-800 mb-4">Documentos Recientes</h3>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="doc in stats.documents.recent_documents.slice(0, 5)" :key="doc._id">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">{{ doc.type }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Cliente {{ doc.client_id }}</td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="[
                  'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                  doc.status === 'completed' ? 'bg-green-100 text-green-800' :
                  doc.status === 'failed' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                ]">
                  {{ doc.status }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ formatDate(doc.created_at) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Loading state -->
    <div v-else-if="isLoading" class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800">Error al cargar estadísticas</h3>
          <div class="mt-2 text-sm text-red-700">{{ error }}</div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="text-center py-12">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">No hay datos disponibles</h3>
      <p class="mt-1 text-sm text-gray-500">Las estadísticas se mostrarán aquí una vez que haya actividad en el sistema.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useDashboard } from '@/composables/useDashboard'

// Estado reactivo
const selectedPeriod = ref('month')
const startDate = ref('')
const endDate = ref('')
const stats = ref<any>(null)

// Usar el composable del dashboard
const { isLoading, error, fetchDashboardStats } = useDashboard()

// Cargar estadísticas al montar el componente
onMounted(() => {
  loadStats()
})

// Funciones
const loadStats = async () => {
  try {
    const params: any = { period: selectedPeriod.value }

    if (selectedPeriod.value === 'custom') {
      if (startDate.value && endDate.value) {
        params.start_date = startDate.value
        params.end_date = endDate.value
      }
    }

    stats.value = await fetchDashboardStats(params)
  } catch (err: any) {
    console.error('Error loading stats:', err)
  }
}

const getPercentage = (value: any, total: any) => {
  const numValue = Number(value) || 0
  const numTotal = Number(total) || 0
  if (numTotal === 0) return 0
  return Math.round((numValue / numTotal) * 100)
}

const formatDate = (dateString: string) => {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch (error) {
    return dateString
  }
}
</script>
