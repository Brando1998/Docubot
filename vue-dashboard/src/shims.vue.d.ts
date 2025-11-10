// Module shims to resolve import errors
declare module "*.vue" {
  const component: any;
  export default component;
}

declare module "axios" {
  const axios: any;
  export default axios;
}

declare module "@vitejs/plugin-vue" {
  const plugin: any;
  export default plugin;
}

declare module "@tailwindcss/vite" {
  const plugin: any;
  export default plugin;
}
