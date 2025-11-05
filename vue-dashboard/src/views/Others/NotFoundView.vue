<template>
  <div class="flex flex-col items-center justify-center h-screen text-center">
    <h1 class="text-6xl font-bold text-red-500">404</h1>
    <p class="text-xl mt-4">Página no encontrada</p>
    <RouterLink
      to="/dashboard"
      class="mt-6 px-4 py-2 bg-blue-600 text-white rounded"
    >
      Volver al inicio
    </RouterLink>
  </div>
</template>

<script setup>
import { RouterLink } from "vue-router";
</script>
