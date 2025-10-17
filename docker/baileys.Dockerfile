FROM node:20-alpine

WORKDIR /app

# Copiar archivos de configuración
COPY package*.json ./
COPY tsconfig.json ./

# Instalar TODAS las dependencias (necesarias para compilar)
RUN npm ci

# Copiar el código fuente
COPY . .

# Compilar TypeScript a JavaScript
RUN npm run build

# Eliminar devDependencies para reducir tamaño
RUN npm prune --production

# Crear directorios necesarios
RUN mkdir -p auth src/sessions

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Cambiar permisos
RUN chown -R nodejs:nodejs /app
USER nodejs

# Exponer puerto
EXPOSE 3000

# Comando de inicio (ahora ejecuta JS compilado)
CMD ["npm", "start"]