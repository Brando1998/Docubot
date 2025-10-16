# Variables del proyecto
PROJECT_NAME := docubot
COMPOSE_FILE := docker-compose.yml
COMPOSE_FILE_PROD := docker-compose.prod.yml

# Variables de entorno (por defecto desarrollo)
ENV ?= dev
COMPOSE_FILE_SELECTED := $(if $(filter prod production, $(ENV)),$(COMPOSE_FILE_PROD),$(COMPOSE_FILE))

# Rutas de archivos .env centralizados
ENV_DIR := env
ENV_DEV_DIR := $(ENV_DIR)/dev
ENV_PROD_DIR := $(ENV_DIR)/prod

.PHONY: help up-local up-prod down-local down-prod build-all build-prod logs-api logs-vue logs-rasa logs-playwright logs-baileys clean clean-project clean-all

help: ## Mostrar ayuda
	@echo "Comandos disponibles:"
	@echo "Variables de entorno:"
	@echo "  ENV=dev|prod    - Entorno (por defecto: dev)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Ejemplos:"
	@echo "  make up-local          # Desarrollo"
	@echo "  make up-prod           # Producción"
	@echo "  make ENV=prod up-local # Forzar producción"

up-local: ## Levantar entorno local con docker-compose (ENV=dev por defecto)
	@echo "🚀 Levantando entorno $(ENV)..."
	@echo "📄 Usando archivo: $(COMPOSE_FILE_SELECTED)"
	docker compose -f $(COMPOSE_FILE_SELECTED) up --build -d
	@echo "✅ Entorno $(ENV) levantado. Verificando servicios..."
	@if [ "$(ENV)" = "prod" ]; then \
		echo "🎨 Vue Dashboard: http://localhost:80"; \
		echo "🔧 API Go: http://localhost:8080"; \
		echo "📊 Rasa: No expuesto externamente"; \
		echo "🎭 Playwright: No expuesto externamente"; \
		echo "💬 Baileys: No expuesto externamente"; \
	else \
		echo "🎨 Vue Dashboard: http://localhost:3002"; \
		echo "🔧 API Go: http://localhost:8080"; \
		echo "📊 Rasa: http://localhost:5005"; \
		echo "🎭 Playwright: http://localhost:3001"; \
		echo "💬 Baileys: http://localhost:3000"; \
	fi

up-prod: ## Levantar entorno de producción (alias para ENV=prod up-local)
	@$(MAKE) ENV=prod up-local

up-sequential: ## Levantar servicios secuencialmente (recomendado) - soporta ENV=dev|prod
	@echo "🚀 Levantando servicios $(ENV) en orden..."
	@echo "📄 Usando archivo: $(COMPOSE_FILE_SELECTED)"
	@echo "1️⃣ Levantando bases de datos..."
	docker compose -f $(COMPOSE_FILE_SELECTED) up -d postgres mongodb
	@echo "⏳ Esperando bases de datos..."
	sleep 10
	@echo "2️⃣ Levantando Rasa..."
	docker compose -f $(COMPOSE_FILE_SELECTED) up -d rasa
	@echo "⏳ Esperando Rasa..."
	sleep 15
	@echo "3️⃣ Levantando Playwright..."
	docker compose -f $(COMPOSE_FILE_SELECTED) up -d playwright
	@echo "⏳ Esperando Playwright..."
	sleep 15
	@echo "4️⃣ Levantando API..."
	docker compose -f $(COMPOSE_FILE_SELECTED) up -d api
	@echo "⏳ Esperando API..."
	sleep 15
	@echo "5️⃣ Levantando Vue Dashboard..."
	docker compose -f $(COMPOSE_FILE_SELECTED) up -d vue
	@echo "⏳ Esperando Vue..."
	sleep 10
	@echo "6️⃣ Levantando Baileys..."
	docker compose -f $(COMPOSE_FILE_SELECTED) up -d baileys
	@echo "✅ Todos los servicios $(ENV) levantados!"
	
down-local: ## Detener entorno local - soporta ENV=dev|prod
	@echo "🛑 Deteniendo entorno $(ENV)..."
	docker compose -f $(COMPOSE_FILE_SELECTED) down

down-prod: ## Detener entorno de producción (alias para ENV=prod down-local)
	@$(MAKE) ENV=prod down-local

build-all: ## Construir todas las imágenes del proyecto - soporta ENV=dev|prod
	@echo "🔨 Construyendo todas las imágenes $(ENV)..."
	docker compose -f $(COMPOSE_FILE_SELECTED) build

build-prod: ## Construir imágenes para producción (alias para ENV=prod build-all)
	@$(MAKE) ENV=prod build-all

build-api: ## Construir solo imagen de API - soporta ENV=dev|prod
	docker compose -f $(COMPOSE_FILE_SELECTED) build api

build-vue: ## Construir solo imagen de Vue - soporta ENV=dev|prod
	docker compose -f $(COMPOSE_FILE_SELECTED) build vue

build-rasa: ## Construir solo imagen de Rasa - soporta ENV=dev|prod
	docker compose -f $(COMPOSE_FILE_SELECTED) build rasa

# Logs por servicio
logs-api: ## Ver logs del API - soporta ENV=dev|prod
	docker compose -f $(COMPOSE_FILE_SELECTED) logs -f api

logs-vue: ## Ver logs del Dashboard Vue - soporta ENV=dev|prod
	docker compose -f $(COMPOSE_FILE_SELECTED) logs -f vue

logs-rasa: ## Ver logs de Rasa - soporta ENV=dev|prod
	docker compose -f $(COMPOSE_FILE_SELECTED) logs -f rasa

logs-playwright: ## Ver logs de Playwright - soporta ENV=dev|prod
	docker compose -f $(COMPOSE_FILE_SELECTED) logs -f playwright

logs-baileys: ## Ver logs de Baileys - soporta ENV=dev|prod
	docker compose -f $(COMPOSE_FILE_SELECTED) logs -f baileys

logs-all: ## Ver logs de todos los servicios del proyecto - soporta ENV=dev|prod
	docker compose -f $(COMPOSE_FILE_SELECTED) logs -f

logs-database: ## Ver logs de bases de datos - soporta ENV=dev|prod
	@echo "🗄️  Logs de bases de datos $(ENV)..."
	docker compose -f $(COMPOSE_FILE_SELECTED) logs -f postgres mongodb

logs-auth: ## Ver logs relacionados con autenticación - soporta ENV=dev|prod
	@echo "🔐 Filtrando logs de autenticación $(ENV)..."
	docker compose -f $(COMPOSE_FILE_SELECTED) logs -f api | grep -i "auth\|login\|admin\|user"


# Estado y salud de servicios
status: ## Verificar estado de servicios del proyecto - soporta ENV=dev|prod
	@echo "📊 Estado de los servicios $(ENV) de $(PROJECT_NAME):"
	@docker compose -f $(COMPOSE_FILE_SELECTED) ps

health-check: ## Verificar salud de servicios del proyecto - soporta ENV=dev|prod
	@echo "🏥 Verificando salud de servicios $(ENV)..."
	@if [ "$(ENV)" = "prod" ]; then \
		echo -n "Postgres: " && (pg_isready -h localhost -p 5432 -U postgres 2>/dev/null && echo "✅" || echo "❌"); \
		echo -n "MongoDB: " && (curl -f http://localhost:27017 2>/dev/null && echo "✅" || echo "❌"); \
		echo -n "Rasa: " && (curl -f http://localhost:5005/status 2>/dev/null && echo "✅" || echo "❌"); \
		echo -n "Playwright: " && (curl -f http://localhost:3001/health 2>/dev/null && echo "✅" || echo "❌"); \
		echo -n "Vue Dashboard: " && (curl -f http://localhost/health 2>/dev/null && echo "✅" || echo "❌"); \
		echo -n "API: " && (curl -f http://localhost:8080/health 2>/dev/null && echo "✅" || echo "❌"); \
		echo -n "Baileys: " && (curl -f http://localhost:3000/health 2>/dev/null && echo "✅" || echo "❌"); \
	else \
		echo -n "Postgres: " && (pg_isready -h localhost -p 5432 -U postgres 2>/dev/null && echo "✅" || echo "❌"); \
		echo -n "MongoDB: " && (curl -f http://localhost:27017 2>/dev/null && echo "✅" || echo "❌"); \
		echo -n "Rasa: " && (curl -f http://localhost:5005/status 2>/dev/null && echo "✅" || echo "❌"); \
		echo -n "Playwright: " && (curl -f http://localhost:3001/health 2>/dev/null && echo "✅" || echo "❌"); \
		echo -n "Vue Dashboard: " && (curl -f http://localhost:3002/health 2>/dev/null && echo "✅" || echo "❌"); \
		echo -n "API: " && (curl -f http://localhost:8080/health 2>/dev/null && echo "✅" || echo "❌"); \
		echo -n "Baileys: " && (curl -f http://localhost:3000/health 2>/dev/null && echo "✅" || echo "❌"); \
	fi

# Limpieza
clean: clean-project ## Limpiar SOLO los contenedores, imágenes y volúmenes de este proyecto

clean-project: ## Limpiar contenedores, imágenes y volúmenes específicos del proyecto - soporta ENV=dev|prod
	@echo "🧹 Limpiando recursos del proyecto $(PROJECT_NAME) ($(ENV))..."
	@echo "⏹️  Deteniendo contenedores del proyecto..."
	-docker compose -f $(COMPOSE_FILE_SELECTED) down -v --remove-orphans 2>/dev/null
	@echo "🗑️  Eliminando contenedores del proyecto..."
	-docker container rm -f $(PROJECT_NAME)-postgres $(PROJECT_NAME)-mongo $(PROJECT_NAME)-rasa $(PROJECT_NAME)-playwright $(PROJECT_NAME)-vue $(PROJECT_NAME)-api $(PROJECT_NAME)-baileys 2>/dev/null || true
	@echo "🖼️  Eliminando imágenes del proyecto..."
	-docker image rm -f $$(docker images --filter "reference=$(PROJECT_NAME)*" -q) 2>/dev/null || true
	-docker image rm -f $$(docker images --filter "reference=docubot*" -q) 2>/dev/null || true
	@echo "💾 Eliminando volúmenes del proyecto..."
	-docker volume rm -f $$(docker volume ls --filter "name=$(PROJECT_NAME)" -q) 2>/dev/null || true
	-docker volume rm -f $$(docker volume ls --filter "name=docubot" -q) 2>/dev/null || true
	@echo "📁 Limpiando volúmenes huérfanos relacionados..."
	-docker volume rm -f $$(docker volume ls -f "label=com.docker.compose.project=$(PROJECT_NAME)" -q) 2>/dev/null || true
	@echo "🌐 Eliminando red del proyecto..."
	-docker network rm $(PROJECT_NAME)-network 2>/dev/null || true
	-docker network rm docubot-network 2>/dev/null || true
	@echo "✅ Limpieza del proyecto $(PROJECT_NAME) ($(ENV)) completada"

clean-all: ## ⚠️  PELIGROSO: Limpiar TODO el sistema Docker (usar con cuidado)
	@echo "⚠️  ADVERTENCIA: Esto eliminará TODOS los contenedores, imágenes, volúmenes y redes del sistema"
	@echo "¿Estás seguro? Presiona Ctrl+C para cancelar, o Enter para continuar..."
	@read dummy
	@echo "🧹 Limpiando TODO el sistema Docker..."
	docker system prune -af --volumes
	@echo "✅ Limpieza completa del sistema"

clean-auth: ## Limpiar datos de autenticación (sessions, tokens)
	@echo "🧹 Limpiando datos de autenticación..."
	@echo "⚠️  Esto cerrará todas las sesiones activas"
	@read -p "¿Continuar? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 0
	docker exec -it docubot-postgres psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-docubot_db} -c "TRUNCATE TABLE system_users CASCADE;"
	@echo "✅ Datos de autenticación limpiados. Reinicia la API para crear el admin por defecto."

reset-database: ## Resetear completamente las bases de datos - soporta ENV=dev|prod
	@echo "💀 PELIGRO: Esto eliminará TODOS los datos ($(ENV))"
	@read -p "¿Estás seguro? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 0
	docker compose -f $(COMPOSE_FILE_SELECTED) down -v
	docker volume rm docubot_postgres_data docubot_mongo_data 2>/dev/null || true
	@echo "✅ Bases de datos ($(ENV)) reseteadas"

# Reinicio de servicios
restart: ## Reiniciar todos los servicios del proyecto - soporta ENV=dev|prod
	@echo "🔄 Reiniciando servicios del proyecto ($(ENV))..."
	docker compose -f $(COMPOSE_FILE_SELECTED) restart

restart-api: ## Reiniciar solo la API - soporta ENV=dev|prod
	docker compose -f $(COMPOSE_FILE_SELECTED) restart api

restart-vue: ## Reiniciar solo Vue Dashboard - soporta ENV=dev|prod
	docker compose -f $(COMPOSE_FILE_SELECTED) restart vue

restart-rasa: ## Reiniciar solo Rasa - soporta ENV=dev|prod
	docker compose -f $(COMPOSE_FILE_SELECTED) restart rasa

restart-baileys: ## Reiniciar solo Baileys - soporta ENV=dev|prod
	docker compose -f $(COMPOSE_FILE_SELECTED) restart baileys

# Comandos de desarrollo
dev-logs: ## Ver logs en tiempo real de todos los servicios - soporta ENV=dev|prod
	docker compose -f $(COMPOSE_FILE_SELECTED) logs -f --tail=100

dev-shell-api-old: ## Abrir shell en el contenedor de la API - soporta ENV=dev|prod
	docker compose -f $(COMPOSE_FILE_SELECTED) exec api /bin/sh

dev-shell-vue: ## Abrir shell en el contenedor de Vue - soporta ENV=dev|prod
	docker compose -f $(COMPOSE_FILE_SELECTED) exec vue /bin/sh

dev-shell-rasa: ## Abrir shell en el contenedor de Rasa - soporta ENV=dev|prod
	docker compose -f $(COMPOSE_FILE_SELECTED) exec rasa /bin/bash

# Comandos específicos de Vue
vue-dev: ## Ejecutar Vue en modo desarrollo (local)
	@echo "🎨 Iniciando Vue en modo desarrollo..."
	cd vue-dashboard && npm run dev

vue-build: ## Compilar Vue para producción (local)
	@echo "🔨 Compilando Vue para producción..."
	cd vue-dashboard && npm run build

vue-install: ## Instalar dependencias de Vue (local)
	@echo "📦 Instalando dependencias de Vue..."
	cd vue-dashboard && npm install

# ===== COMANDOS DE RASA =====
rasa-train: ## Entrenar modelo de Rasa y limpiar modelos antiguos
	@echo "🤖 Entrenando modelo de Rasa..."
	@echo "🧹 Limpiando modelos antiguos..."
	cd rasa-bot && find models/ -name "*.tar.gz" -type f ! -name "current-model.tar.gz" -exec rm -f {} \; 2>/dev/null || true
	@echo "✅ Modelos antiguos eliminados"
	cd rasa-bot && rasa train --fixed-model-name current-model
	@echo "✅ Modelo entrenado exitosamente"

rasa-clean-models: ## Limpiar solo modelos antiguos de Rasa (mantener current-model)
	@echo "🧹 Limpiando modelos antiguos de Rasa..."
	cd rasa-bot && find models/ -name "*.tar.gz" -type f ! -name "current-model.tar.gz" -exec rm -f {} \;
	@echo "✅ Modelos antiguos eliminados. Modelos restantes:"
	@cd rasa-bot && ls -la models/ | grep -E "\.tar\.gz|current-model"

rasa-list-models: ## Listar todos los modelos de Rasa disponibles
	@echo "📋 Modelos de Rasa disponibles:"
	@cd rasa-bot && ls -la models/ | grep -E "\.tar\.gz|current-model" | head -10
	@echo ""
	@echo "💡 Para usar un modelo específico:"
	@echo "   cd rasa-bot && ln -sf models/NOMBRE_MODELO.tar.gz models/current-model.tar.gz"

rasa-shell: ## Abrir shell interactivo de Rasa
	@echo "💬 Abriendo shell interactivo de Rasa..."
	cd rasa-bot && rasa shell

# ===== GESTIÓN DE ARCHIVOS .ENV =====
env-sync: ## Sincronizar archivos .env desde el directorio centralizado
	@echo "🔄 Sincronizando archivos .env..."
	@cp $(ENV_DEV_DIR)/api.env ./.env 2>/dev/null || echo "⚠️  .env no encontrado"
	@cp $(ENV_DEV_DIR)/baileys.env ./baileys-ws/.env 2>/dev/null || echo "⚠️  baileys .env no encontrado"
	@cp $(ENV_DEV_DIR)/rasa.env ./rasa-bot/.env 2>/dev/null || echo "⚠️  rasa .env no encontrado"
	@cp $(ENV_DEV_DIR)/playwright.env ./playwright-bot/.env 2>/dev/null || echo "⚠️  playwright .env no encontrado"
	@cp $(ENV_DEV_DIR)/vue.env ./vue-dashboard/.env 2>/dev/null || echo "⚠️  vue .env no encontrado"
	@echo "✅ Archivos .env sincronizados desde $(ENV_DEV_DIR)"

env-backup: ## Respaldar archivos .env actuales al directorio centralizado
	@echo "💾 Respaldando archivos .env actuales..."
	@cp ./.env $(ENV_DEV_DIR)/api.env 2>/dev/null || echo "⚠️  .env no encontrado"
	@cp ./baileys-ws/.env $(ENV_DEV_DIR)/baileys.env 2>/dev/null || echo "⚠️  baileys .env no encontrado"
	@cp ./rasa-bot/.env $(ENV_DEV_DIR)/rasa.env 2>/dev/null || echo "⚠️  rasa .env no encontrado"
	@cp ./playwright-bot/.env $(ENV_DEV_DIR)/playwright.env 2>/dev/null || echo "⚠️  playwright .env no encontrado"
	@cp ./vue-dashboard/.env $(ENV_DEV_DIR)/vue.env 2>/dev/null || echo "⚠️  vue .env no encontrado"
	@echo "✅ Archivos .env respaldados en $(ENV_DEV_DIR)"

env-list: ## Listar todos los archivos .env disponibles
	@echo "📋 Archivos .env disponibles:"
	@echo ""
	@echo "🔧 Desarrollo ($(ENV_DEV_DIR)/):"
	@ls -la $(ENV_DEV_DIR)/ | grep "\.env" | awk '{print "   " $$9}'
	@echo ""
	@echo "🏭 Producción ($(ENV_PROD_DIR)/):"
	@ls -la $(ENV_PROD_DIR)/ | grep "\.env" | awk '{print "   " $$9}'
	@echo ""
	@echo "💡 Comandos útiles:"
	@echo "   make env-sync     # Copiar desde centralizado"
	@echo "   make env-backup   # Respaldar al centralizado"

# Comandos Kubernetes
k8s-deploy: ## Desplegar en Kubernetes
	kubectl apply -f k8s/configmaps/
	kubectl apply -f k8s/secrets/
	kubectl apply -f k8s/deployments/
	kubectl apply -f k8s/services/

k8s-delete: ## Eliminar despliegue de Kubernetes
	kubectl delete -f k8s/services/
	kubectl delete -f k8s/deployments/
	kubectl delete -f k8s/secrets/
	kubectl delete -f k8s/configmaps/

# Comandos de información
show-containers: ## Mostrar solo los contenedores de este proyecto - soporta ENV=dev|prod
	@echo "📦 Contenedores del proyecto $(PROJECT_NAME) ($(ENV)):"
	@docker ps -a --filter "name=$(PROJECT_NAME)" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

show-images: ## Mostrar solo las imágenes de este proyecto - soporta ENV=dev|prod
	@echo "🖼️  Imágenes del proyecto $(PROJECT_NAME) ($(ENV)):"
	@docker images --filter "reference=$(PROJECT_NAME)*" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

show-volumes: ## Mostrar solo los volúmenes de este proyecto - soporta ENV=dev|prod
	@echo "💾 Volúmenes del proyecto $(PROJECT_NAME) ($(ENV)):"
	@docker volume ls --filter "name=$(PROJECT_NAME)" --format "table {{.Name}}\t{{.Size}}"

# Comandos útiles para desarrollo
open-urls: ## Abrir todas las URLs del proyecto en el navegador - soporta ENV=dev|prod
	@echo "🌐 Abriendo URLs del proyecto ($(ENV))..."
	@if [ "$(ENV)" = "prod" ]; then \
		which open >/dev/null && (open http://localhost:80 && open http://localhost:8080/health) || echo "Comando 'open' no disponible. URLs: http://localhost:80 http://localhost:8080/health"; \
	else \
		which open >/dev/null && (open http://localhost:3002 && open http://localhost:8080/health && open http://localhost:5005/status) || echo "Comando 'open' no disponible. URLs: http://localhost:3002 http://localhost:8080/health http://localhost:5005/status"; \
	fi

check-ports: ## Verificar qué puertos están en uso - soporta ENV=dev|prod
	@echo "🔍 Verificando puertos del proyecto ($(ENV))..."
	@if [ "$(ENV)" = "prod" ]; then \
		echo "Puerto 80 (Vue):" && (lsof -i :80 2>/dev/null || echo "  Libre"); \
		echo "Puerto 8080 (API):" && (lsof -i :8080 2>/dev/null || echo "  Libre"); \
		echo "Puerto 5005 (Rasa):" && (lsof -i :5005 2>/dev/null || echo "  Libre"); \
		echo "Puerto 3001 (Playwright):" && (lsof -i :3001 2>/dev/null || echo "  Libre"); \
		echo "Puerto 3000 (Baileys):" && (lsof -i :3000 2>/dev/null || echo "  Libre"); \
	else \
		echo "Puerto 3002 (Vue):" && (lsof -i :3002 2>/dev/null || echo "  Libre"); \
		echo "Puerto 8080 (API):" && (lsof -i :8080 2>/dev/null || echo "  Libre"); \
		echo "Puerto 5005 (Rasa):" && (lsof -i :5005 2>/dev/null || echo "  Libre"); \
		echo "Puerto 3001 (Playwright):" && (lsof -i :3001 2>/dev/null || echo "  Libre"); \
		echo "Puerto 3000 (Baileys):" && (lsof -i :3000 2>/dev/null || echo "  Libre"); \
	fi

# ===== GESTIÓN DE USUARIOS ADMIN =====
create-admin: ## Crear usuario administrador manualmente - soporta ENV=dev|prod
	@echo "🔧 Ejecutando script de creación de admin ($(ENV))..."
	docker compose -f $(COMPOSE_FILE_SELECTED) exec api /app/scripts/create_admin.sh

reset-admin: ## Resetear contraseña del administrador - soporta ENV=dev|prod
	@echo "🔄 Ejecutando reset de credenciales de admin ($(ENV))..."
	docker compose -f $(COMPOSE_FILE_SELECTED) exec api sh -c "cd /app && go run ./scripts/reset-admin.go"

list-admins: ## Listar usuarios administradores - soporta ENV=dev|prod
	@echo "📋 Listando usuarios administradores ($(ENV))..."
	docker compose -f $(COMPOSE_FILE_SELECTED) exec api sh -c "cd /app && go run -c 'database.ConnectPostgres(); db := database.GetDB(); var users []models.SystemUser; db.Where(\"role = ?\", \"admin\").Find(&users); for _, u := range users { fmt.Printf(\"ID: %d | Username: %s | Email: %s | Active: %t\\n\", u.ID, u.Username, u.Email, u.IsActive) }'"

show-admin-credentials: ## Mostrar credenciales por defecto del admin
	@echo "🔑 Credenciales por defecto del administrador:"
	@echo "   Username: ${ADMIN_USERNAME:-admin}"
	@echo "   Email: ${ADMIN_EMAIL:-admin@docubot.local}"
	@echo "   Password: ${ADMIN_PASSWORD:-DocubotAdmin123!}"
	@echo ""
	@echo "⚠️  Estas credenciales se usan solo si no existe un usuario admin en la BD"
	@echo "💡 Configura ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD en .env para personalizar"

# ===== DESARROLLO CON SHELL DE CONTENEDORES =====
dev-shell-api: ## Abrir shell en contenedor API para desarrollo - soporta ENV=dev|prod
	@echo "🐚 Abriendo shell en el contenedor API ($(ENV))..."
	@echo "💡 Comandos útiles:"
	@echo "   - go run ./scripts/reset-admin.go"
	@echo "   - go run ./cmd/create_user.go"
	@echo ""
	docker compose -f $(COMPOSE_FILE_SELECTED) exec api bash

dev-shell-postgres: ## Conectar a PostgreSQL - soporta ENV=dev|prod
	@echo "🗄️  Conectando a PostgreSQL ($(ENV))..."
	docker compose -f $(COMPOSE_FILE_SELECTED) exec postgres psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-docubot_db}
