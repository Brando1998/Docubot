import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],

  resolve: {
    alias: {
      "@": "/src",
    },
  },

  // Configuración del servidor de desarrollo
  server: {
    host: "0.0.0.0",
    port: 5173,
    // Direct connection to AWS API - no proxy needed
    // Proxy removed since we connect directly to 18.223.102.115:8080
  },

  // Configuración para producción
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    minify: "esbuild",
  },

  // Variables de entorno
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
  },
});
