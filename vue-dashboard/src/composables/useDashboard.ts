import { ref } from 'vue'
import api from '@/services/api'

export function useDashboard() {
  const isLoading = ref(false)
  const error = ref('')

  const clearError = () => {
    error.value = ''
  }

  const fetchDashboardStats = async (params: any = {}) => {
    try {
      isLoading.value = true
      clearError()

      const response = await api.get('/api/v1/dashboard/stats', { params })
      return response.data.stats
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || 'Error obteniendo estadísticas'
      console.error('Error fetching dashboard stats:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  return {
    isLoading,
    error,
    clearError,
    fetchDashboardStats
  }
}