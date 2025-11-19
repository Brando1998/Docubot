# Guía de Testing Local - Playwright Bot

## 🚀 Opción 1: Testing con Node.js Local (Recomendado para desarrollo)

### Prerrequisitos
- Node.js 20+ instalado
- Chromium o Chrome instalado

### Pasos

#### 1. Instalar Dependencias
```powershell
cd playwright-bot
npm install
```

#### 2. Instalar Playwright Browsers
```powershell
npx playwright install chromium
```

#### 3. Verificar Archivo .env
El archivo `.env` ya está creado con tus credenciales RNDC. Verifica que exista:
```powershell
cat .env
```

#### 4. Crear Directorio de Descargas
```powershell
mkdir downloads
```

#### 5. Iniciar el Servidor
```powershell
# Modo desarrollo (con logs pretty)
npm run dev

# O modo producción
npm start
```

#### 6. Verificar que Arrancó
```powershell
# En otra terminal
curl http://localhost:3001/health
```

Deberías ver:
```json
{
  "status": "ok",
  "service": "playwright-bot",
  "botInitialized": true,
  "queueStats": { ... }
}
```

---

## 🐳 Opción 2: Testing con Docker (Solo Playwright)

### Solo el servicio playwright

```powershell
# Desde la raíz del proyecto
docker compose up playwright --build
```

### Ver logs en tiempo real
```powershell
docker logs -f docubot-playwright
```

### Detener
```powershell
docker compose down playwright
```

---

## 🧪 Tests Básicos

### 1. Health Check
```powershell
curl http://localhost:3001/health
```

**Respuesta esperada**:
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

### 2. Test de Validación (debe fallar)
```powershell
# NIT inválido
$body = @'
{
  "remesa": {
    "consecutivo": "TEST001",
    "descripcionCorta": "Test",
    "cantidadEstimada": 10,
    "empresa": {
      "nit": "123",
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
'@

Invoke-WebRequest -Uri http://localhost:3001/api/manifiesto `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

**Respuesta esperada**: `400 Bad Request`
```json
{
  "success": false,
  "error": "Validación de datos fallida",
  "details": [
    {
      "field": "remesa.empresa.nit",
      "message": "\"remesa.empresa.nit\" with value \"123\" fails to match the required pattern: /^\\d{9,10}$/",
      "type": "string.pattern.base"
    }
  ]
}
```

### 3. Test Completo (crear manifiesto real)

> ⚠️ **IMPORTANTE**: Esto crea un manifiesto REAL en el sistema RNDC. Asegúrate de usar datos válidos o de prueba.

```powershell
# Cargar datos de prueba
$body = Get-Content test-data.json -Raw

# Enviar request
$response = Invoke-WebRequest -Uri http://localhost:3001/api/manifiesto `
  -Method POST `
  -ContentType "application/json" `
  -Body $body

# Ver respuesta
$response.Content | ConvertFrom-Json
```

**Respuesta esperada**: `200 OK`
```json
{
  "success": true,
  "consecutivoRemesa": "12345",
  "consecutivoManifiesto": "67890",
  "downloadUrl": "http://localhost:3001/api/download/uuid-file-id",
  "expiresAt": "2025-11-20T16:00:00.000Z"
}
```

### 4. Descargar PDF Generado
```powershell
# Reemplazar {fileId} con el ID del response anterior
curl http://localhost:3001/api/download/{fileId} -o manifiesto.pdf

# Abrir PDF
start manifiesto.pdf
```

### 5. Verificar Queue Stats
```powershell
curl http://localhost:3001/api/queue/stats
```

---

## 📊 Verificar Logs

### Logs en Desarrollo (Pretty)
Si usaste `npm run dev`, verás logs como:
```
[2025-11-19 11:35:00] INFO (playwright-bot): Server started
    port: 3001
    downloadDir: "./downloads"

[2025-11-19 11:35:01] INFO (RNDCBot): Initializing browser

[2025-11-19 11:35:03] INFO (RNDCBot): Browser initialized successfully

[2025-11-19 11:36:00] INFO (ManifiestoEndpoint): Received manifiesto creation request
    remesaConsecutivo: "TEST001"

[2025-11-19 11:36:02] INFO (RNDCBot): Starting login to RNDC

[2025-11-19 11:36:05] INFO (RNDCBot): Login successful

[2025-11-19 11:36:10] INFO (RNDCBot): Remesa created
    consecutivo: "12345"
```

### Logs en Producción (JSON)
Si usaste `npm start`, verás logs JSON:
```json
{"level":"info","time":1700400000,"service":"playwright-bot","msg":"Server started","port":3001}
{"level":"info","component":"RNDCBot","msg":"Browser initialized successfully"}
```

---

## 🐛 Troubleshooting

### Error: "npm no se reconoce"
Node.js no está instalado o no está en el PATH.

**Solución**:
1. Instalar Node.js desde https://nodejs.org (versión 20 LTS)
2. Reiniciar terminal
3. Verificar: `node --version`

### Error: "RNDC credentials not configured"
Falta el archivo `.env` o las variables `RNDC_USUARIO`/`RNDC_CONTRASENA`.

**Solución**:
```powershell
# Verificar que existe .env
cat .env

# Debe tener:
# RNDC_USUARIO=...
# RNDC_CONTRASENA=...
```

### Error: "Chromium not found"
Playwright no encuentra el navegador.

**Solución**:
```powershell
npx playwright install chromium
```

### Error: "Login failed"
Credenciales RNDC incorrectas o el sitio cambió.

**Solución**:
1. Verificar credenciales en `.env`
2. Intentar login manual en https://rndc.mintransporte.gov.co
3. Revisar logs para ver el error específico

### Error: "Port 3001 already in use"
Otro proceso está usando el puerto.

**Solución**:
```powershell
# Cambiar puerto en .env
PORT=3002

# O matar proceso que usa 3001
netstat -ano | findstr :3001
taskkill /PID {PID} /F
```

### Archivos no persisten al reiniciar
El volumen Docker no está montado (solo aplica en Docker).

**Solución en Local**: Los archivos se guardan en `./downloads/` y persisten automáticamente.

---

## 📝 Datos de Prueba

### Ejemplo Mínimo Válido
```json
{
  "remesa": {
    "consecutivo": "MIN001",
    "descripcionCorta": "Mercancía de prueba",
    "cantidadEstimada": 10,
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
    "valorPagar": "100000",
    "lugarPago": "Medellín"
  }
}
```

### Valores que DEBES Ajustar
- `empresa.nit`: NIT real registrado en RNDC
- `empresa.sedeCargue`: Código de sede válido para ese NIT
- `empresa.sedeDescargue`: Código de sede válido para ese NIT
- `municipioOrigen`: Debe existir en RNDC (prueba con "Bogotá")
- `municipioDestino`: Debe existir en RNDC
- `titularNumeroId`: Cédula del titular del manifiesto
- `placaVehiculo`: Placa real del vehículo
- `conductorNumeroId`: Cédula del conductor

---

## ✅ Checklist de Testing

- [ ] Health check responde OK
- [ ] Bot se inicializa correctamente (sin errores de credenciales)
- [ ] Validación rechaza NITs inválidos (400)
- [ ] Validación rechaza placas inválidas (400)
- [ ] Manifiesto se crea correctamente (200)
- [ ] PDF se descarga correctamente
- [ ] Logs son legibles y descriptivos
- [ ] Rate limiting funciona (11+ requests → 429)
- [ ] Archivos persisten en `./downloads/`
- [ ] Archivo `records.json` se crea en `./downloads/`
- [ ] Reintentos funcionan (simular fallo)

---

## 📞 Si necesitas ayuda

1. **Revisar logs**: Los logs te dirán exactamente qué falló
2. **Verificar .env**: Asegúrate de que todas las variables están configuradas
3. **Probar credenciales**: Intenta login manual en RNDC
4. **Revisar datos**: Los municipios y sedes deben ser válidos

---

## 🎯 Próximos Pasos

Una vez que funcione en local:

1. **Commitear cambios**:
   ```powershell
   git add .
   git commit -m "feat: playwright-bot improvements - validation, retry, logs"
   ```

2. **Testing en Docker**:
   ```powershell
   docker compose up playwright --build
   ```

3. **Deployment a producción**:
   ```powershell
   docker compose -f docker-compose.prod.yml up -d playwright
   ```
