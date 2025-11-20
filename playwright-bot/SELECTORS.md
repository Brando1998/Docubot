# Guía de Selectores RNDC

## 📋 Descripción

Este módulo extrae y mantiene actualizadas las opciones válidas de todos los campos `<select>` del formulario RNDC para:
- Validar datos antes de enviar
- Proveer a los clientes las opciones válidas
- Detectar cambios en las opciones de RNDC

## 🚀 Uso

### 1. Extracción Inicial

La primera vez, debes extraer los selectores manualmente:

```bash
npm run update-selectors
```

Esto creará el archivo `data/rndc-selectors.json` con todas las opciones.

### 2. Consultar Opciones

#### Obtener todos los selectores
```bash
curl http://localhost:3001/api/selectors
```

**Respuesta**:
```json
{
  "success": true,
  "data": {
    "lastUpdated": "2025-11-19T17:00:00Z",
    "remesa": { ... },
    "manifiesto": { ... }
  },
  "lastUpdated": "2025-11-19T17:00:00Z"
}
```

#### Obtener selectores de Remesa
```bash
curl http://localhost:3001/api/selectors/remesa
```

#### Obtener un campo específico de Remesa
```bash
curl http://localhost:3001/api/selectors/remesa/tipoOperacion
```

**Respuesta**:
```json
{
  "success": true,
  "field": "tipoOperacion",
  "options": [
    { "value": "1", "label": "Mercancia Consolidada" },
    { "value": "2", "label": "Carga Suelta" },
    { "value": "3", "label": "Contenedor" }
  ],
  "lastUpdated": "2025-11-19T17:00:00Z"
}
```

#### Obtener selectores de Manifiesto
```bash
curl http://localhost:3001/api/selectors/manifiesto
```

#### Obtener un campo específico de Manifiesto
```bash
curl http://localhost:3001/api/selectors/manifiesto/tipoManifiesto
```

## 📊 Campos Extraídos

### Formulario de Remesa

- **tipoOperacion**: Tipo de operación de carga
- **tipoEmpaque**: Tipo de empaque
- **capitulo**: Capítulo arancelario
- **partida**: Partida arancelaria
- **tipoIdentificacion**: Tipos de ID (Nit, Cédula, etc.)
- **tomadorPoliza**: Opciones de póliza

### Formulario de Manifiesto

- **tipoManifiesto**: General o Individual
- **tipoIdTitular**: Tipos de ID para titular
- **tipoIdConductor**: Tipos de ID para conductor
- **pagadorCargue**: Quién paga el cargue
- **pagadorDescargue**: Quién paga el descargue

## 🔄 Actualización Automática

### Cron Job

El sistema actualiza los selectores **automáticamente todos los días a las 2 AM**.

Si hay cambios, se logueará un warning:
```json
{
  "level": "warn",
  "msg": "RNDC selector options have changed!",
  "changes": [
    {
      "type": "added",
      "form": "remesa",
      "field": "tipoOperacion",
      "options": [{ "value": "4", "label": "Nueva Opción" }]
    }
  ]
}
```

### Actualización Manual

Puedes forzar una actualización en cualquier momento:

```bash
npm run update-selectors
```

## ⚠️ Campos con Autocomplete

Los siguientes campos NO se extraen porque usan búsqueda dinámica:

- **Municipio Origen**: Búsqueda por texto
- **Municipio Destino**: Búsqueda por texto  
- **Lugar de Pago**: Búsqueda por texto
- **Sedes**: Dependen del NIT ingresado

**Estrategia para Autocomplete**:
- El bot captura las opciones cuando aparecen en tiempo real
- Si hay error, se devuelven las opciones disponibles al momento
- NO se persisten en el JSON (son dinámicas)

## 🧪 Testing

### Test 1: Verificar extracción
```bash
# Ejecutar extracción
npm run update-selectors

# Verificar archivo generado
cat data/rndc-selectors.json
```

### Test 2: Consultar API
```bash
# Obtener todos
curl http://localhost:3001/api/selectors

# Obtener campo específico
curl http://localhost:3001/api/selectors/remesa/tipoOperacion
```

### Test 3: Probar con datos inválidos

```bash
# Este request debería fallar porque "OpcionInvalida" no está en tipoOperacion
curl -X POST http://localhost:3001/api/manifiesto \
  -H "Content-Type: application/json" \
  -d '{
    "remesa": {
      "consecutivo": "TEST001",
      "tipoOperacion": "OpcionInvalida",
      ...
    }
  }'
```

### Test 4: Verificar actualización diaria

```bash
# Ver logs del cron job (esperar hasta las 2 AM o cambiar horario)
docker logs -f docubot-playwright | grep "selector update"
```

## 📝 Estructura del JSON

```json
{
  "lastUpdated": "2025-11-19T17:00:00.000Z",
  "remesa": {
    "tipoOperacion": [
      {
        "value": "1",
        "label": "Mercancia Consolidada"
      }
    ],
    "tipoEmpaque": [...],
    "capitulo": [...],
    "partida": [...],
    "tipoIdentificacion": [...],
    "tomadorPoliza": [...]
  },
  "manifiesto": {
    "tipoManifiesto": [...],
    "tipoIdTitular": [...],
    "tipoIdConductor": [...],
    "pagadorCargue": [...],
    "pagadorDescargue": [...]
  }
}
```

## 🔧 Configuración

### Variables de Entorno

Las mismas credenciales RNDC que usa el bot:

```env
RNDC_USUARIO=tu_usuario
RNDC_CONTRASENA=tu_contraseña
RNDC_LOGIN_URL=https://rndc.mintransporte.gov.co/...
```

### Cambiar Horario del Cron

En `index.js`, línea del cron:

```javascript
// Cambiar de 2 AM a 3 AM
cron.schedule("0 3 * * *", async () => { ... });

// Ejecutar cada 6 horas
cron.schedule("0 */6 * * *", async () => { ... });
```

## 🐛 Troubleshooting

### Error: "Selectors not available"

No se ha ejecutado la extracción inicial.

**Solución**:
```bash
npm run update-selectors
```

### Error: "Login failed"

Credenciales RNDC incorrectas.

**Solución**:
- Verificar `RNDC_USUARIO` y `RNDC_CONTRASENA` en `.env`
- Probar login manual en el sitio RNDC

### Selectores desactualizados

El cron no se ejecutó o falló.

**Solución**:
```bash
# Forzar actualización manual
npm run update-selectors

# Verificar logs del cron
docker logs docubot-playwright | grep "selector update"
```

### Cambios no detectados

El script compara con la versión anterior.

**Verificar**:
- Revisar logs: `"changeCount": 0` significa sin cambios
- Si realmente hay cambios, borrar `data/rndc-selectors.json` y volver a extraer

## 💡 Mejoras Futuras

1. **Notificaciones**: Enviar email/Slack cuando hay cambios
2. **Historial**: Guardar versiones anteriores de los selectores
3. **Validación dinámica**: Validar requests con las opciones actuales
4. **Dashboard**: Vista web de los selectores disponibles
5. **Caché**: Cachear selectores en memoria para consultas rápidas

## 📄 Archivos Relacionados

- `scripts/extract-selectors.js` - Extractor principal
- `scripts/update-selectors.js` - Script de actualización con detección de cambios
- `data/rndc-selectors.json` - Archivo JSON con las opciones
- `index.js` - Endpoints API y cron job
