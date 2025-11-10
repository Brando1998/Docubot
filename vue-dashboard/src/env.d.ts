/// <reference types="vite/client" />

// Environment variables
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly NODE_ENV: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Vue type declarations for .vue files
declare module "*.vue" {
  const component: any;
  export default component;
}

// API service type declaration
declare module "../services/api" {
  const api: any;
  export default api;
}
