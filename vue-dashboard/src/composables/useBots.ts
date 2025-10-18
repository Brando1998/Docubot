import { ref } from 'vue'
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

interface BotInstance {
  id: number
  name: string
  port: number
  status: string
  whatsapp_number: string
  based_on_bot_id: number
  created_at: string
}

export function useBots() {
  const bots = ref<BotInstance[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const fetchBots = async () => {
    isLoading.value = true
    error.value = null
    try {
      const token = localStorage.getItem('access_token')
      const response = await axios.get(`${API_BASE_URL}/api/v1/bot-instances`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      bots.value = response.data || []
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Error cargando bots'
      console.error('Error fetching bots:', err)
    } finally {
      isLoading.value = false
    }
  }

  const createBot = async (data: { name: string; whatsapp_number: string; based_on_bot_id?: number }) => {
    isLoading.value = true
    error.value = null
    try {
      const token = localStorage.getItem('access_token')
      const response = await axios.post(`${API_BASE_URL}/api/v1/bot-instances`, data, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      await fetchBots()
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Error creando bot'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const deleteBot = async (id: number) => {
    isLoading.value = true
    error.value = null
    try {
      const token = localStorage.getItem('access_token')
      await axios.delete(`${API_BASE_URL}/api/v1/bot-instances/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      await fetchBots()
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Error eliminando bot'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  return {
    bots,
    isLoading,
    error,
    fetchBots,
    createBot,
    deleteBot
  }
}