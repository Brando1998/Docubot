FROM node:20-alpine AS builder

WORKDIR /app

# 🔥 IMPORTANTE: Declarar ARG para recibir variables del docker-compose
ARG VITE_API_URL=http://localhost:8080

# 🔥 Convertir ARG a ENV para que Vite las pueda leer
ENV VITE_API_URL=$VITE_API_URL

# Copiar archivos de configuración
COPY package*.json ./
COPY vite.config.ts ./
COPY tsconfig*.json ./
COPY index.html ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY src/ ./src/
COPY public/ ./public/

# Build para producción (ahora con las variables de entorno)
RUN npm run build

# Imagen final con servidor ligero
FROM nginx:alpine

# Copiar archivos compilados
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3002

CMD ["nginx", "-g", "daemon off;"]