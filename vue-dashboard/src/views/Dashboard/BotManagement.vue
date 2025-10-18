<template>
  <div class="bot-management">
    <h1>Gestión de Bots</h1>
    
    <div class="create-bot">
      <h2>Crear Nuevo Bot</h2>
      <form @submit.prevent="createBot">
        <input v-model="newBot.name" placeholder="Nombre del bot" required />
        <input v-model="newBot.whatsapp_number" placeholder="Número WhatsApp" required />
        <button type="submit">Crear Bot</button>
      </form>
    </div>
    
    <div class="bot-list">
      <h2>Bots Activos</h2>
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Puerto</th>
            <th>Estado</th>
            <th>WhatsApp</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="bot in bots" :key="bot.id">
            <td>{{ bot.name }}</td>
            <td>{{ bot.port }}</td>
            <td>
              <span :class="'status-' + bot.status">{{ bot.status }}</span>
            </td>
            <td>{{ bot.whatsapp_number }}</td>
            <td>
              <button @click="deleteBot(bot.id)" class="btn-danger">Eliminar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'

interface BotInstance {
  id: number
  name: string
  port: number
  status: string
  whatsapp_number: string
}

const bots = ref<BotInstance[]>([])
const newBot = ref({
  name: '',
  based_on_bot_id: 1,
  whatsapp_number: ''
})

async function loadBots() {
  const response = await axios.get('http://localhost:8080/api/bot-instances')
  bots.value = response.data
}

async function createBot() {
  await axios.post('http://localhost:8080/api/bot-instances', newBot.value)
  newBot.value = { name: '', based_on_bot_id: 1, whatsapp_number: '' }
  await loadBots()
}

async function deleteBot(id: number) {
  if (confirm('¿Seguro que quieres eliminar este bot?')) {
    await axios.delete(`http://localhost:8080/api/bot-instances/${id}`)
    await loadBots()
  }
}

onMounted(() => {
  loadBots()
})
</script>

<style scoped>
.bot-management {
  padding: 20px;
}

.create-bot form {
  display: flex;
  gap: 10px;
  margin: 20px 0;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 10px;
  border: 1px solid #ddd;
  text-align: left;
}

.status-running { color: green; }
.status-stopped { color: red; }
.btn-danger { background: red; color: white; }
</style>