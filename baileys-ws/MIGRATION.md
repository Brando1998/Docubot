# Guía de Migración a Multi-Sesión

Esta guía te ayudará a migrar de la versión de sesión única a la nueva versión con soporte para múltiples sesiones.

## Cambios Principales

### 1. Estructura de Archivos

**Antes:**
```
auth/
  ├── creds.json
  ├── pre-key-*.json
  └── session-*.json
```

**Después:**
```
auth/
  ├── default/          # Sesión por defecto (compatible con API legacy)
  │   ├── creds.json
  │   └── ...
  ├── cliente1/         # Nueva sesión
  │   ├── creds.json
  │   └── ...
  └── cliente2/         # Otra sesión
      ├── creds.json
      └── ...
```

### 2. API Endpoints

#### Endpoints Legacy (Siguen Funcionando)

Estos endpoints usan automáticamente la sesión "default":

```bash
# Antes y Después (sin cambios)
GET  /qr
POST /send
POST /restart
GET  /health
GET  /status
```

#### Nuevos Endpoints Multi-Sesión

```bash
# Gestión de sesiones
POST   /sessions/:sessionId              # Crear sesión
GET    /sessions                         # Listar todas las sesiones
GET    /sessions/:sessionId/qr           # Obtener QR de sesión
GET    /sessions/:sessionId/status       # Estado de sesión
POST   /sessions/:sessionId/send         # Enviar mensaje
POST   /sessions/:sessionId/restart      # Reiniciar sesión
DELETE /sessions/:sessionId              # Eliminar sesión
```

## Pasos de Migración

### Opción 1: Migración Automática (Recomendada)

Si ya tienes credenciales en `auth/`, el sistema las usará automáticamente para la sesión "default":

1. **Actualizar el código:**
   ```bash
   git pull origin main
   npm install
   ```

2. **Mover credenciales existentes (si es necesario):**
   ```bash
   # Si tienes credenciales en auth/ directamente
   mkdir -p auth/default
   mv auth/*.json auth/default/ 2>/dev/null || true
   ```

3. **Actualizar variables de entorno:**
   ```bash
   cp .env.example .env
   # Editar .env con tus valores
   ```

4. **Iniciar el servicio:**
   ```bash
   npm start
   ```

### Opción 2: Inicio Limpio

Si prefieres empezar desde cero:

1. **Respaldar credenciales antiguas:**
   ```bash
   mv auth auth.backup
   ```

2. **Actualizar el código:**
   ```bash
   git pull origin main
   npm install
   ```

3. **Configurar variables de entorno:**
   ```bash
   cp .env.example .env
   # Editar .env
   ```

4. **Iniciar y crear nueva sesión:**
   ```bash
   npm start
   
   # En otra terminal
   curl -X POST http://localhost:3000/sessions/default
   curl http://localhost:3000/sessions/default/qr
   ```

## Actualizar Código Cliente

### Antes (Sesión Única)

```javascript
// Obtener QR
const response = await fetch('http://localhost:3000/qr');
const data = await response.json();

// Enviar mensaje
await fetch('http://localhost:3000/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    number: '573001234567',
    message: 'Hola'
  })
});
```

### Después (Multi-Sesión)

#### Opción A: Usar API Legacy (Sin Cambios)

```javascript
// Funciona exactamente igual que antes
const response = await fetch('http://localhost:3000/qr');
const data = await response.json();

await fetch('http://localhost:3000/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    number: '573001234567',
    message: 'Hola'
  })
});
```

#### Opción B: Usar Nueva API Multi-Sesión

```javascript
// Crear sesión
await fetch('http://localhost:3000/sessions/cliente1', {
  method: 'POST'
});

// Obtener QR
const response = await fetch('http://localhost:3000/sessions/cliente1/qr');
const data = await response.json();

// Enviar mensaje
await fetch('http://localhost:3000/sessions/cliente1/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    number: '573001234567',
    message: 'Hola desde cliente1'
  })
});
```

## Casos de Uso Comunes

### 1. Mantener Sesión Única (Sin Cambios)

Si solo necesitas una sesión, no necesitas cambiar nada. El sistema seguirá funcionando igual usando la sesión "default".

### 2. Agregar Nuevas Sesiones

```bash
# Crear sesiones adicionales
curl -X POST http://localhost:3000/sessions/ventas
curl -X POST http://localhost:3000/sessions/soporte
curl -X POST http://localhost:3000/sessions/marketing

# Cada una tendrá su propio QR y credenciales
curl http://localhost:3000/sessions/ventas/qr
curl http://localhost:3000/sessions/soporte/qr
curl http://localhost:3000/sessions/marketing/qr
```

### 3. Gestionar Múltiples Clientes

```javascript
// Crear sesión por cliente
const clientes = ['cliente1', 'cliente2', 'cliente3'];

for (const cliente of clientes) {
  await fetch(`http://localhost:3000/sessions/${cliente}`, {
    method: 'POST'
  });
}

// Enviar mensajes desde diferentes sesiones
await fetch('http://localhost:3000/sessions/cliente1/send', {
  method: 'POST',
  body: JSON.stringify({
    number: '573001111111',
    message: 'Mensaje desde cliente1'
  })
});

await fetch('http://localhost:3000/sessions/cliente2/send', {
  method: 'POST',
  body: JSON.stringify({
    number: '573002222222',
    message: 'Mensaje desde cliente2'
  })
});
```

## Configuración Recomendada

### Variables de Entorno

```env
# Producción con múltiples clientes
MAX_SESSIONS=20
MAX_RECONNECT_ATTEMPTS=5
SESSION_TIMEOUT=3600000      # 1 hora
CLEANUP_INTERVAL=600000      # 10 minutos

# Desarrollo/Testing
MAX_SESSIONS=5
MAX_RECONNECT_ATTEMPTS=3
SESSION_TIMEOUT=1800000      # 30 minutos
CLEANUP_INTERVAL=300000      # 5 minutos
```

## Monitoreo Post-Migración

### 1. Verificar Sesiones Activas

```bash
curl http://localhost:3000/sessions
```

### 2. Verificar Estado del Sistema

```bash
curl http://localhost:3000/health
```

### 3. Revisar Logs

```bash
# Los logs ahora incluyen el ID de sesión
✅ [default] Conexión WhatsApp establecida
📨 [cliente1] Mensaje de 573001234567: Hola
🔄 [cliente2] Reiniciando sesión...
```

## Rollback (Volver a Versión Anterior)

Si necesitas volver a la versión anterior:

1. **Restaurar código:**
   ```bash
   # El código anterior está respaldado
   cp src/index.old.ts src/index.ts
   ```

2. **Restaurar credenciales:**
   ```bash
   # Si moviste las credenciales
   mv auth/default/*.json auth/
   rmdir auth/default
   ```

3. **Reiniciar servicio:**
   ```bash
   npm start
   ```

## Preguntas Frecuentes

### ¿Puedo usar ambas APIs al mismo tiempo?

Sí, los endpoints legacy y los nuevos endpoints multi-sesión funcionan simultáneamente.

### ¿Qué pasa con mis credenciales existentes?

Las credenciales en `auth/` se usarán automáticamente para la sesión "default". No se perderán.

### ¿Cuántas sesiones puedo tener?

Por defecto 10, pero puedes ajustar `MAX_SESSIONS` en `.env`.

### ¿Las sesiones persisten después de reiniciar?

Sí, las credenciales se guardan en disco en `auth/:sessionId/`.

### ¿Cómo elimino una sesión?

```bash
curl -X DELETE http://localhost:3000/sessions/:sessionId
```

Esto cerrará la conexión y eliminará las credenciales.

## Soporte

Si encuentras problemas durante la migración:

1. Revisa los logs del servicio
2. Verifica las variables de entorno
3. Consulta el README.md para documentación completa
4. Revisa los ejemplos en este documento

## Checklist de Migración

- [ ] Respaldar credenciales existentes
- [ ] Actualizar código (`git pull`)
- [ ] Instalar dependencias (`npm install`)
- [ ] Configurar variables de entorno (`.env`)
- [ ] Mover credenciales a `auth/default/` si es necesario
- [ ] Compilar proyecto (`npm run build`)
- [ ] Iniciar servicio (`npm start`)
- [ ] Verificar sesión default (`curl /qr`)
- [ ] Probar endpoints legacy
- [ ] Probar nuevos endpoints multi-sesión
- [ ] Actualizar código cliente si es necesario
- [ ] Configurar monitoreo
- [ ] Documentar sesiones creadas