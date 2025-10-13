# Baileys-WS Multi-Session

Sistema de gestión de múltiples sesiones de WhatsApp usando Baileys.

## Características

- ✅ Soporte para múltiples sesiones simultáneas
- ✅ Gestión automática de recursos y limpieza de sesiones inactivas
- ✅ API REST completa para gestión de sesiones
- ✅ Reconexión automática con backoff exponencial
- ✅ Límite configurable de sesiones concurrentes

## Configuración

Copia el archivo `.env.example` a `.env` y ajusta los valores:

```bash
cp .env.example .env
```

### Variables de Entorno

```env
# Puerto del servidor HTTP
WS_PORT=3000

# URL del backend API
API_URL=http://api:8080

# Nombre del bot
BOT_NAME=DocuBot

# Configuración de sesiones múltiples
MAX_SESSIONS=10                    # Máximo de sesiones simultáneas
MAX_RECONNECT_ATTEMPTS=5           # Intentos de reconexión por sesión
SESSION_TIMEOUT=1800000            # Timeout de sesión inactiva (30 min)
CLEANUP_INTERVAL=300000            # Intervalo de limpieza (5 min)
```

## Instalación

```bash
npm install
```

## Ejecución

```bash
# Desarrollo
npm start

# Producción
npm run build
node dist/index.js
```

## API Endpoints

### Gestión de Sesiones

#### Crear Nueva Sesión

```http
POST /sessions/:sessionId
```

Crea una nueva sesión de WhatsApp con el ID especificado.

**Ejemplo:**
```bash
curl -X POST http://localhost:3000/sessions/cliente1
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Sesión creada correctamente",
  "session": {
    "id": "cliente1",
    "status": {
      "connected": false,
      "number": "",
      "name": "",
      "qr_code": "",
      "qr_image": "",
      "last_disconnect_reason": "",
      "reconnect_attempts": 0,
      "created_at": "2025-10-13T12:00:00.000Z",
      "last_activity": "2025-10-13T12:00:00.000Z"
    }
  }
}
```

#### Obtener QR de Sesión

```http
GET /sessions/:sessionId/qr
```

Obtiene el código QR para escanear en WhatsApp.

**Ejemplo:**
```bash
curl http://localhost:3000/sessions/cliente1/qr
```

**Respuesta (esperando escaneo):**
```json
{
  "status": "waiting_for_scan",
  "message": "Escanea el código QR en WhatsApp",
  "qr_code": "2@...",
  "qr_image": "data:image/png;base64,...",
  "connected": false,
  "session_id": "cliente1"
}
```

**Respuesta (conectado):**
```json
{
  "status": "connected",
  "message": "WhatsApp ya está conectado",
  "connected": true,
  "session_info": {
    "id": "cliente1",
    "number": "573001234567",
    "name": "Bot Cliente1",
    "last_activity": "2025-10-13T12:05:00.000Z"
  }
}
```

#### Obtener Estado de Sesión

```http
GET /sessions/:sessionId/status
```

Obtiene el estado completo de una sesión.

**Ejemplo:**
```bash
curl http://localhost:3000/sessions/cliente1/status
```

#### Listar Todas las Sesiones

```http
GET /sessions
```

Lista todas las sesiones activas.

**Ejemplo:**
```bash
curl http://localhost:3000/sessions
```

**Respuesta:**
```json
{
  "total": 2,
  "sessions": [
    {
      "id": "cliente1",
      "status": {
        "connected": true,
        "number": "573001234567",
        "name": "Bot Cliente1"
      },
      "has_qr": false
    },
    {
      "id": "cliente2",
      "status": {
        "connected": false,
        "number": "",
        "name": ""
      },
      "has_qr": true
    }
  ]
}
```

#### Enviar Mensaje

```http
POST /sessions/:sessionId/send
```

Envía un mensaje desde una sesión específica.

**Body:**
```json
{
  "number": "573001234567",
  "message": "Hola desde la sesión cliente1"
}
```

**Ejemplo:**
```bash
curl -X POST http://localhost:3000/sessions/cliente1/send \
  -H "Content-Type: application/json" \
  -d '{"number":"573001234567","message":"Hola!"}'
```

#### Reiniciar Sesión

```http
POST /sessions/:sessionId/restart
```

Reinicia una sesión existente.

**Ejemplo:**
```bash
curl -X POST http://localhost:3000/sessions/cliente1/restart
```

#### Eliminar Sesión

```http
DELETE /sessions/:sessionId
```

Elimina una sesión y limpia sus credenciales.

**Ejemplo:**
```bash
curl -X DELETE http://localhost:3000/sessions/cliente1
```

### Endpoints de Monitoreo

#### Health Check

```http
GET /health
```

Verifica el estado del servicio.

**Respuesta:**
```json
{
  "status": "ok",
  "service": "baileys-ws",
  "timestamp": "2025-10-13T12:00:00.000Z",
  "total_sessions": 2,
  "connected_sessions": 1,
  "disconnected_sessions": 1,
  "max_sessions": 10,
  "sessions_with_qr": 1,
  "memory_usage": {
    "rss": 123456789,
    "heapTotal": 98765432,
    "heapUsed": 87654321,
    "external": 1234567,
    "arrayBuffers": 123456
  },
  "uptime": 3600
}
```

#### Status General

```http
GET /status
```

Obtiene estadísticas detalladas del sistema.

## Gestión de Recursos

### Límites

- **Sesiones máximas**: Configurable via `MAX_SESSIONS` (default: 10)
- **Reintentos de conexión**: Configurable via `MAX_RECONNECT_ATTEMPTS` (default: 5)
- **Timeout de sesión**: Configurable via `SESSION_TIMEOUT` (default: 30 minutos)

### Limpieza Automática

El sistema ejecuta una tarea de limpieza periódica que:

1. Identifica sesiones inactivas (sin actividad por más de `SESSION_TIMEOUT`)
2. Cierra las conexiones de WhatsApp
3. Limpia las credenciales almacenadas
4. Libera recursos del sistema

Intervalo configurable via `CLEANUP_INTERVAL` (default: 5 minutos)

### Almacenamiento de Credenciales

Las credenciales de cada sesión se almacenan en:

```
auth/
  ├── cliente1/
  │   ├── creds.json
  │   └── ...
  ├── cliente2/
  │   ├── creds.json
  │   └── ...
  └── default/
      ├── creds.json
      └── ...
```

## Flujo de Trabajo Típico

### 1. Crear y Conectar una Sesión

```bash
# 1. Crear sesión
curl -X POST http://localhost:3000/sessions/cliente1

# 2. Obtener QR
curl http://localhost:3000/sessions/cliente1/qr

# 3. Escanear QR en WhatsApp

# 4. Verificar conexión
curl http://localhost:3000/sessions/cliente1/status
```

### 2. Enviar Mensajes

```bash
curl -X POST http://localhost:3000/sessions/cliente1/send \
  -H "Content-Type: application/json" \
  -d '{
    "number": "573001234567",
    "message": "Hola desde cliente1"
  }'
```

### 3. Gestionar Múltiples Sesiones

```bash
# Crear múltiples sesiones
curl -X POST http://localhost:3000/sessions/cliente1
curl -X POST http://localhost:3000/sessions/cliente2
curl -X POST http://localhost:3000/sessions/cliente3

# Listar todas
curl http://localhost:3000/sessions

# Enviar desde diferentes sesiones
curl -X POST http://localhost:3000/sessions/cliente1/send -d '...'
curl -X POST http://localhost:3000/sessions/cliente2/send -d '...'
```

## Arquitectura

```
baileys-ws/
├── src/
│   ├── index.ts                    # Servidor Express y endpoints
│   ├── managers/
│   │   └── SessionManager.ts       # Gestor de sesiones múltiples
│   ├── sessions/
│   │   └── auth.ts                 # Gestión de autenticación
│   ├── types/
│   │   └── session.types.ts        # Tipos TypeScript
│   ├── handlers/
│   │   └── messageHandler.ts       # Manejo de mensajes
│   └── websocket/
│       └── client.ts               # Cliente WebSocket
└── auth/                           # Credenciales por sesión
    ├── cliente1/
    ├── cliente2/
    └── default/
```

## Monitoreo y Debugging

### Logs

El sistema genera logs detallados con prefijos por sesión:

```
✅ [cliente1] Conexión WhatsApp establecida
📨 [cliente1] Mensaje de 573001234567: Hola
🔄 [cliente2] Reiniciando sesión...
🧹 Limpiando sesión inactiva: cliente3
```

### Métricas

Usa el endpoint `/health` para monitorear:

- Número total de sesiones
- Sesiones conectadas vs desconectadas
- Uso de memoria
- Uptime del servicio

## Troubleshooting

### Sesión no se conecta

1. Verificar que el QR se generó correctamente
2. Revisar logs para errores de conexión
3. Intentar reiniciar la sesión: `POST /sessions/:sessionId/restart`

### Límite de sesiones alcanzado

1. Verificar sesiones activas: `GET /sessions`
2. Eliminar sesiones innecesarias: `DELETE /sessions/:sessionId`
3. Aumentar `MAX_SESSIONS` en `.env`

### Sesión se desconecta frecuentemente

1. Verificar conexión a internet
2. Revisar `MAX_RECONNECT_ATTEMPTS`
3. Verificar que no haya otra instancia usando las mismas credenciales

## Migración desde Versión Anterior

Si estás migrando desde la versión de sesión única, consulta [MIGRATION.md](MIGRATION.md) para una guía completa.

## Licencia

ISC