# Playwright Bot - RNDC Automation Service

Servicio de automatización web que utiliza Playwright para interactuar con el sistema RNDC (Registro Nacional de Despacho de Carga) del Ministerio de Transporte de Colombia.

## 🚀 Características

### ✅ Mejoras Implementadas (Versión 2.0)

- **Validación de Entrada**: Validación exhaustiva con Joi incluyendo formatos de NIT, placas, fechas
- **Logs Estructurados**: Logs en JSON con Pino para agregación y análisis
- **Rate Limiting**: Protección contra sobrecarga (10 req/min configurable)
- **Cola de Tareas**: Procesamiento secuencial con p-queue para evitar conflictos
- **Persistencia**: Almacenamiento JSON de registros de archivos, sobrevive reinicios
- **Retry Logic**: Reintentos automáticos con exponential backoff
- **NIT Dinámico**: Sopor Parámetros de empresa configurables por request
- **Sin Timeouts**: Espera inteligente de eventos de página en vez de delays fijos
- **Validación de Credenciales**: Verifica credenciales RNDC al iniciar

## 📋 Requisitos

- Node.js 20+
- Docker (para deployment)
- Credenciales RNDC válidas

## 🔧 Configuración

### Variables de Entorno

Copia `.env.example` a `.env` y configura:

```bash
# RNDC Credentials (REQUERIDO)
RNDC_USUARIO=tu_usuario
RNDC_CONTRASENA=tu_contraseña

# Server Configuration
PORT=3001
NODE_ENV=production

# Retry Configuration
MAX_RETRIES=3
RETRY_DELAY_MS=2000

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=10
RATE_LIMIT_WINDOW_MS=60000

# Queue
QUEUE_CONCURRENCY=1
QUEUE_TIMEOUT_MS=300000
```

## 🏗️ Instalación

```bash
# Instalar dependencias
npm install

# Desarrollo
npm run dev

# Producción
npm start
```

## 🐳 Docker

```bash
# Local
docker compose up playwright

# Producción
docker compose -f docker-compose.prod.yml up -d playwright
```

## 📡 API Endpoints

### `POST /api/manifiesto`

Crea un manifiesto RNDC completo (remesa + manifiesto + PDF).

**Request Body**:
```json
{
  "remesa": {
    "consecutivo": "REM001",
    "descripcionCorta": "Mercancía general",
    "cantidadEstimada": 100,
    "empresa": {
      "nit": "8600537463",
      "sedeCargue": "SEDE-001",
      "sedeDescargue": "SEDE-002"
    }
  },
  "manifiesto": {
    "municipioOrigen": "Bogotá",
    "municipioDestino": "Medellín",
    "titularNumeroId": "1234567890",
    "placaVehiculo": "ABC123",
    "conductorNumeroId": "9876543210",
    "valorPagar": "500000",
    "lugarPago": "Medellín"
  }
}
```

**Response**:
```json
{
  "success": true,
  "consecutivoRemesa": "12345",
  "consecutivoManifiesto": "67890",
  "downloadUrl": "http://localhost:3001/api/download/uuid-file-id",
  "expiresAt": "2025-11-20T10:00:00.000Z"
}
```

### `GET /api/download/:fileId`

Descarga el PDF del manifiesto generado.

### `GET /health`

Health check del servicio.

**Response**:
```json
{
  "status": "ok",
  "service": "playwright-bot",
  "botInitialized": true,
  "queueStats": {
    "size": 0,
    "pending": 0,
    "isPaused": false
  }
}
```

### `GET /api/queue/stats`

Estadísticas de la cola de tareas.

## 🔍 Validación de Datos

### Formatos Requeridos

- **NIT**: 9-10 dígitos numéricos
- **Placa**: Formato ABC123 (3 letras + 3 números mayúsculas)
- **Cédula/ID**: 6-10 dígitos numéricos
- **Fechas**: ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ)
- **Tiempos**: Formato HH:MM

Ver [validation/schemas.js](validation/schemas.js) para detalles completos.

## 📊 Logs

Los logs están estructurados en formato JSON (producción) o pretty (desarrollo).

Ejemplo de log estructurado:
```json
{
  "level": "info",
  "time": 1637250000000,
  "service": "playwright-bot",
  "component": "RNDCBot",
  "msg": "Remesa created",
  "consecutivo": "12345"
}
```

## 🔄 Retry Logic

El servicio reintenta automáticamente en caso de:
- Errores de red (timeout, ECONNRESET, ECONNREFUSED)
- Errores de navegación de Playwright
- Errores 502/503 del servidor RNDC

Configuración por defecto:
- 3 reintentos máximos
- Delay inicial: 2 segundos
- Exponential backoff (2x)
- Delay máximo: 10 segundos

## 🗂️ Persistencia de Archivos

Los archivos PDF generados se almacenan en el volumen `playwright_downloads`.

- **Expiración**: 24 horas desde creación
- **Limpieza**: Cron job cada hora
- **Registro**: Archivo `records.json` con metadata de todos los archivos

## ⚡ Rate Limiting

- **Límite por defecto**: 10 requests por minuto
- **Respuesta**: HTTP 429 con mensaje descriptivo
- **Configurable**: Variables `RATE_LIMIT_*` en `.env`

## 🛠️ Arquitectura

```
playwright-bot/
├── bot/
│   └── rndcBot.js          # Lógica de automatización Playwright
├── storage/
│   └── fileManager.js      # Gestión de archivos con persistencia JSON
├── queue/
│   └── taskQueue.js        # Cola de tareas con p-queue
├── utils/
│   ├── logger.js           # Logger Pino configurado
│   └── retry.js            # Utilidad de reintentos
├── validation/
│   └── schemas.js          # Schemas Joi para validación
├── middleware/
│   └── validation.js       # Middleware Express de validación
└── index.js                # Servidor Express principal
```

## 🧪 Testing

```bash
# Test básico de health
curl http://localhost:3001/health

# Test de validación (debe fallar)
curl -X POST http://localhost:3001/api/manifiesto \
  -H "Content-Type: application/json" \
  -d '{"invalid": "data"}'

# Test completo (requiere datos válidos)
curl -X POST http://localhost:3001/api/manifiesto \
  -H "Content-Type: application/json" \
  -d @test-data.json
```

## 📝 Changelog

### v2.0.0 - 2025-11-19

- ✨ Validación exhaustiva con Joi
- 📊 Logs estructurados con Pino
- 🚦 Rate limiting con express-rate-limit
- 🔄 Cola de tareas con p-queue
- 💾 Persistencia JSON de registros
- ⚡ Retry logic con exponential backoff
- 🏢 NIT dinámico por request
- ⏱️ Eliminación de timeouts fijos
- ✅ Validación de credenciales RNDC

## 🐛 Troubleshooting

### Bot no se inicializa

- Verificar que`RNDC_USUARIO` y `RNDC_CONTRASENA` estén configuradas
- Verificar conectividad al sitio RNDC
- Revisar logs: `docker logs docubot-playwright`

### Archivos no persisten

- Verificar que el volumen `playwright_downloads` esté montado
- Verificar permisos del directorio `/downloads`

### Requests lentos

- La cola procesa tareas secuencialmente (1 a la vez por defecto)
- Revisar estadísticas: `GET /api/queue/stats`

## 📄 Licencia

[Definir licencia del proyecto]
