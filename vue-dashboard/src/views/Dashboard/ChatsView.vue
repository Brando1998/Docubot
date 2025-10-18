<template>
  <div class="h-screen flex bg-gray-50">
    <!-- Panel Izquierdo: Lista de Chats -->
    <div class="w-1/3 bg-white border-r border-gray-200 flex flex-col">
      <!-- Header del panel de chats -->
      <div class="p-4 border-b border-gray-200">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold text-gray-800">Chats</h2>

          <button
            @click="loadChats"
            :disabled="isLoading"
            class="text-blue-500 hover:text-blue-700 disabled:opacity-50"
            title="Actualizar chats"
          >
            <svg
              v-if="isLoading"
              class="animate-spin h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <svg
              v-else
              class="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>

        <!-- Barra de búsqueda -->
        <div class="mb-3">
          <input
            v-model="chatSearch"
            @input="filterChats"
            placeholder="Buscar chats..."
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

        <!-- 🔥 NUEVO: Selector de Bot -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2"
            >Filtrar por Bot</label
          >
          <select
            v-model="selectedBot"
            @change="filterChats"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todos los Bots</option>
            <option v-for="bot in bots" :key="bot.id" :value="bot.whatsapp_number">
              {{ bot.name }} ({{ bot.whatsapp_number }})
            </option>
          </select>
        </div>

        <!-- Filtros -->
        <div class="flex flex-wrap gap-2">
          <button
            v-for="filter in chatFilters"
            :key="filter.key"
            @click="setFilter(filter.key)"
            :class="[
              'px-3 py-1 text-xs rounded-full transition-colors',
              chatFilter === filter.key
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            ]"
          >
            {{ filter.label }}
          </button>
        </div>
      </div>

      <!-- Lista de Chats -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="filteredChats.length > 0" class="divide-y divide-gray-100">
          <div
            v-for="chat in filteredChats"
            :key="chat.id"
            @click="selectChat(chat)"
            :class="[
              'p-3 cursor-pointer hover:bg-gray-50 transition-colors',
              selectedChat?.id === chat.id ? 'bg-blue-50 border-r-2 border-blue-500' : '',
            ]"
          >
            <div class="flex items-center justify-between mb-2">
              <h4 class="font-medium text-gray-900 text-sm truncate flex-1">
                {{ chat.name }}
              </h4>
              <div class="flex items-center space-x-1">
                <span
                  v-if="chat.unreadCount > 0"
                  class="bg-red-500 text-white text-xs px-2 py-1 rounded-full"
                >
                  {{ chat.unreadCount }}
                </span>
                <span
                  v-if="chat.isGroup"
                  class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full"
                >
                  G
                </span>
              </div>
            </div>
            <p v-if="chat.lastMessage" class="text-xs text-gray-600 truncate mb-1">
              {{ chat.lastMessage.text }}
            </p>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-500">
                {{ formatChatDate(chat.lastMessage?.timestamp) }}
              </span>
              <span
                :class="[
                  'text-xs px-2 py-1 rounded-full',
                  chat.botMode
                    ? 'bg-green-100 text-green-800'
                    : 'bg-blue-100 text-blue-800',
                ]"
              >
                {{ chat.botMode ? "Bot" : "Humano" }}
              </span>
            </div>
          </div>
        </div>

        <!-- Sin chats -->
        <div v-else-if="!isLoading" class="text-center py-8 px-4">
          <svg
            class="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">No hay chats disponibles</h3>
          <p class="mt-1 text-sm text-gray-500">
            Los chats aparecerán aquí cuando WhatsApp esté conectado
          </p>
        </div>
      </div>
    </div>

    <!-- Panel Derecho: Conversación -->
    <div class="flex-1 flex flex-col bg-white">
      <!-- Header de la conversación -->
      <div v-if="selectedChat" class="p-4 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <h3 class="text-lg font-semibold text-gray-800">{{ selectedChat.name }}</h3>
            <span
              v-if="selectedChat.isGroup"
              class="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full"
            >
              Grupo
            </span>
          </div>
          <div class="flex items-center space-x-3">
            <!-- Toggle Bot/Humano -->
            <div class="flex items-center space-x-2">
              <span class="text-sm text-gray-600">Bot</span>
              <button
                @click="toggleChatMode(selectedChat)"
                :class="[
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  selectedChat.botMode ? 'bg-green-600' : 'bg-gray-200',
                ]"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    selectedChat.botMode ? 'translate-x-6' : 'translate-x-1',
                  ]"
                />
              </button>
              <span class="text-sm text-gray-600">Humano</span>
            </div>

            <!-- Acciones -->
            <div class="flex space-x-2">
              <button
                @click="exportChat"
                :disabled="isLoading"
                class="text-blue-500 hover:text-blue-700 disabled:opacity-50"
                title="Exportar conversación"
              >
                <svg
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </button>
              <button
                @click="archiveSelectedChat"
                :disabled="isLoading"
                class="text-orange-500 hover:text-orange-700 disabled:opacity-50"
                title="Archivar chat"
              >
                <svg
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Área de Mensajes -->
      <div class="flex-1 overflow-y-auto p-4" ref="messagesContainer">
        <div
          v-if="!selectedChat"
          class="flex items-center justify-center h-full text-center"
        >
          <div>
            <svg
              class="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <h3 class="mt-2 text-sm font-medium text-gray-900">Selecciona un chat</h3>
            <p class="mt-1 text-sm text-gray-500">
              Elige un chat de la lista para ver la conversación
            </p>
          </div>
        </div>

        <div v-else-if="chatMessages.length === 0" class="text-center py-8">
          <p class="text-gray-500">No hay mensajes para mostrar</p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="message in chatMessages"
            :key="message.id"
            :class="['flex', message.fromMe ? 'justify-end' : 'justify-start']"
          >
            <div
              :class="[
                'max-w-xs lg:max-w-md px-4 py-2 rounded-lg',
                message.fromMe ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800',
              ]"
            >
              <p class="text-sm">{{ message.text }}</p>
              <p
                :class="[
                  'text-xs mt-1',
                  message.fromMe ? 'text-blue-100' : 'text-gray-500',
                ]"
              >
                {{ formatMessageDate(message.timestamp) }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Input para enviar mensajes -->
      <div v-if="selectedChat" class="p-4 border-t border-gray-200">
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
            <svg
              v-if="isLoading"
              class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <svg
              v-else
              class="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
            {{ isLoading ? "Enviando..." : "Enviar" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";
import { useWhatsApp } from "@/composables/useWhatsApp";
import { useBots } from '@/composables/useBots'

// Usar el composable con métodos de chats
const { isLoading, getChats, getChatMessages, sendChatMessage } = useWhatsApp();

// Bots
const selectedBot = ref('');
const { bots, fetchBots } = useBots();

// Estado para gestión de chats
const chats = ref<any[]>([]);
const filteredChats = ref<any[]>([]);
const selectedChat = ref<any>(null);
const chatMessages = ref<any[]>([]);
const newMessage = ref("");
const messagesContainer = ref<HTMLElement>();
const chatSearch = ref("");
const chatFilter = ref("all");

// Filtros disponibles
const chatFilters = [
  { key: "all", label: "Todos" },
  { key: "bot", label: "Modo Bot" },
  { key: "user", label: "Modo Humano" },
  { key: "unread", label: "Sin leer" },
];

// Estado para mensajes de UI
const message = ref("");
const messageType = ref<"success" | "error">("success");

// Funciones para gestión de chats
const loadChats = async () => {
  try {
    const data = await getChats();
    chats.value = data.chats || [];

    // Inicializar modo bot por defecto para chats nuevos
    for (const chat of chats.value) {
      if (chat.botMode === undefined) {
        chat.botMode = true; // Por defecto en modo bot
      }
    }

    filterChats();
    showMessage("Chats cargados correctamente", "success");
  } catch (err: any) {
    showMessage("Error cargando chats", "error");
    console.error("Error loading chats:", err);
  }
};

onMounted(() => {
  loadChats();
  fetchBots();
})

const filterChats = () => {
  let filtered = [...chats.value];

  if (selectedBot.value) {
    filtered = filtered.filter(chat => chat.botNumber === selectedBot.value)
  }

  // Filtro de búsqueda
  if (chatSearch.value.trim()) {
    const searchTerm = chatSearch.value.toLowerCase();
    filtered = filtered.filter(
      (chat) =>
        chat.name.toLowerCase().includes(searchTerm) ||
        (chat.lastMessage?.text &&
          chat.lastMessage.text.toLowerCase().includes(searchTerm))
    );
  }

  // Filtro por modo
  if (chatFilter.value !== "all") {
    switch (chatFilter.value) {
      case "bot":
        filtered = filtered.filter((chat) => chat.botMode);
        break;
      case "user":
        filtered = filtered.filter((chat) => !chat.botMode);
        break;
      case "unread":
        filtered = filtered.filter((chat) => chat.unreadCount > 0);
        break;
    }
  }

  filteredChats.value = filtered;
};

const setFilter = (filterKey: string) => {
  chatFilter.value = filterKey;
  filterChats();
};

const selectChat = async (chat: any) => {
  selectedChat.value = chat;
  await loadChatMessages(chat.id);
};

const loadChatMessages = async (chatId: string) => {
  try {
    const data = await getChatMessages(chatId);
    chatMessages.value = data.messages || [];
    await nextTick();
    scrollToBottom();
  } catch (err: any) {
    showMessage("Error cargando mensajes", "error");
    console.error("Error loading messages:", err);
  }
};

const toggleChatMode = async (chat: any) => {
  const newMode = !chat.botMode;
  try {
    // TODO: Implementar persistencia en BD cuando esté disponible
    // await updateChatMode(chat.id, newMode)
    chat.botMode = newMode;
    showMessage(
      `Modo ${newMode ? "bot" : "humano"} activado para ${chat.name}`,
      "success"
    );
  } catch (err: any) {
    showMessage("Error actualizando modo de chat", "error");
    console.error("Error updating chat mode:", err);
  }
};

const sendMessage = async () => {
  if (!newMessage.value.trim() || !selectedChat.value) return;

  try {
    // Determinar si enviar al bot o a Rasa basado en el modo del chat
    if (selectedChat.value.botMode) {
      // Modo bot: enviar mensaje normal (el bot responderá)
      await sendChatMessage(selectedChat.value.id, newMessage.value.trim());
    } else {
      // Modo humano: redirigir a Rasa
      await sendMessageToRasa(selectedChat.value.id, newMessage.value.trim());
    }

    // Agregar mensaje a la lista local
    const message = {
      id: Date.now().toString(),
      text: newMessage.value.trim(),
      fromMe: true,
      timestamp: Date.now() / 1000,
    };
    chatMessages.value.push(message);
    newMessage.value = "";
    await nextTick();
    scrollToBottom();
    showMessage("Mensaje enviado", "success");
  } catch (err: any) {
    showMessage("Error enviando mensaje", "error");
    console.error("Error sending message:", err);
  }
};

// Función para enviar mensaje a Rasa (modo humano)
const sendMessageToRasa = async (chatId: string, message: string) => {
  // TODO: Implementar envío a Rasa cuando la API esté disponible
  // Por ahora, solo loguear
  console.log(`Enviando mensaje a Rasa para chat ${chatId}: ${message}`);

  // Simular respuesta de Rasa para testing
  setTimeout(() => {
    const rasaResponse = {
      id: Date.now().toString() + "_rasa",
      text: `Respuesta de Rasa: "${message}"`,
      fromMe: false,
      timestamp: Date.now() / 1000,
    };
    chatMessages.value.push(rasaResponse);
    nextTick().then(scrollToBottom);
  }, 1000);
};

const archiveSelectedChat = async () => {
  if (!selectedChat.value) return;

  try {
    // Simular archivado por ahora
    showMessage(`Chat "${selectedChat.value.name}" archivado correctamente`, "success");
    // Remover de la lista de chats
    chats.value = chats.value.filter((chat) => chat.id !== selectedChat.value.id);
    selectedChat.value = null;
    chatMessages.value = [];
  } catch (err: any) {
    showMessage("Error archivando chat", "error");
    console.error("Error archiving chat:", err);
  }
};

const exportChat = async () => {
  if (!selectedChat.value) return;

  try {
    const conversationText = chatMessages.value
      .map(
        (msg: any) =>
          `${formatMessageDate(msg.timestamp)} ${msg.fromMe ? "Tú" : "Cliente"}: ${
            msg.text || msg.message
          }`
      )
      .join("\n");

    const blob = new Blob([conversationText], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat_${selectedChat.value.name}_${
      new Date().toISOString().split("T")[0]
    }.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showMessage("Conversación exportada correctamente", "success");
  } catch (err: any) {
    showMessage("Error exportando conversación", "error");
    console.error("Error exporting conversation:", err);
  }
};

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

// Utilidades
const showMessage = (text: string, type: "success" | "error" = "success") => {
  message.value = text;
  messageType.value = type;
  setTimeout(clearMessage, 5000);
};

const clearMessage = () => {
  message.value = "";
};

const formatChatDate = (timestamp?: number) => {
  if (!timestamp) return "";
  try {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString("es-CO", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    return "";
  }
};

const formatMessageDate = (timestamp?: number) => {
  if (!timestamp) return "";
  try {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    return "";
  }
};

// Cargar chats al montar el componente
onMounted(async () => {
  await loadChats();
});
</script>
