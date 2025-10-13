# Ejemplos de Uso - Baileys-WS Multi-Sesión

Ejemplos prácticos para usar el sistema de múltiples sesiones.

## Tabla de Contenidos

1. [Configuración Inicial](#configuración-inicial)
2. [Sesión Única (Legacy)](#sesión-única-legacy)
3. [Múltiples Sesiones](#múltiples-sesiones)
4. [Casos de Uso Avanzados](#casos-de-uso-avanzados)
5. [Integración con Backend](#integración-con-backend)

## Configuración Inicial

### 1. Instalar y Configurar

```bash
# Clonar o actualizar
cd baileys-ws

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
nano .env

# Compilar
npm run build

# Iniciar
npm start
```

### 2. Verificar que el Servicio Está Corriendo

```bash
curl http://localhost:3000/health
```

## Sesión Única (Legacy)

### Ejemplo 1: Conectar WhatsApp (Modo Simple)

```bash
# 1. Obtener QR
curl http://localhost:3000/qr

# 2. Escanear el QR en WhatsApp

# 3. Verificar conexión
curl http://localhost:3000/qr
# Respuesta: {"status":"connected",...}
```

### Ejemplo 2: Enviar Mensaje Simple

```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{
    "number": "573001234567",
    "message": "Hola desde Baileys!"
  }'
```

### Ejemplo 3: Reiniciar Sesión

```bash
curl -X POST http://localhost:3000/restart
```

## Múltiples Sesiones

### Ejemplo 4: Crear y Gestionar Múltiples Sesiones

```bash
# Crear sesión para ventas
curl -X POST http://localhost:3000/sessions/ventas

# Crear sesión para soporte
curl -X POST http://localhost:3000/sessions/soporte

# Crear sesión para marketing
curl -X POST http://localhost:3000/sessions/marketing

# Listar todas las sesiones
curl http://localhost:3000/sessions
```

### Ejemplo 5: Conectar Múltiples Sesiones

```bash
# Obtener QR de cada sesión
curl http://localhost:3000/sessions/ventas/qr
curl http://localhost:3000/sessions/soporte/qr
curl http://localhost:3000/sessions/marketing/qr

# Escanear cada QR en diferentes dispositivos WhatsApp

# Verificar estado de cada sesión
curl http://localhost:3000/sessions/ventas/status
curl http://localhost:3000/sessions/soporte/status
curl http://localhost:3000/sessions/marketing/status
```

### Ejemplo 6: Enviar Mensajes desde Diferentes Sesiones

```bash
# Mensaje desde ventas
curl -X POST http://localhost:3000/sessions/ventas/send \
  -H "Content-Type: application/json" \
  -d '{
    "number": "573001111111",
    "message": "Hola! Soy del equipo de ventas"
  }'

# Mensaje desde soporte
curl -X POST http://localhost:3000/sessions/soporte/send \
  -H "Content-Type: application/json" \
  -d '{
    "number": "573002222222",
    "message": "Hola! Soy del equipo de soporte"
  }'

# Mensaje desde marketing
curl -X POST http://localhost:3000/sessions/marketing/send \
  -H "Content-Type: application/json" \
  -d '{
    "number": "573003333333",
    "message": "Hola! Tenemos una promoción especial"
  }'
```

## Casos de Uso Avanzados

### Ejemplo 7: Sistema Multi-Cliente

```javascript
// Node.js - Gestionar sesiones por cliente
const axios = require('axios');
const BASE_URL = 'http://localhost:3000';

class WhatsAppMultiClient {
  constructor() {
    this.clients = new Map();
  }

  async createClient(clientId) {
    try {
      // Crear sesión
      await axios.post(`${BASE_URL}/sessions/${clientId}`);
      
      // Obtener QR
      const response = await axios.get(`${BASE_URL}/sessions/${clientId}/qr`);
      
      this.clients.set(clientId, {
        id: clientId,
        qr: response.data.qr_image,
        connected: response.data.connected
      });

      return response.data;
    } catch (error) {
      console.error(`Error creando cliente ${clientId}:`, error.message);
      throw error;
    }
  }

  async sendMessage(clientId, number, message) {
    try {
      const response = await axios.post(
        `${BASE_URL}/sessions/${clientId}/send`,
        { number, message }
      );
      return response.data;
    } catch (error) {
      console.error(`Error enviando mensaje desde ${clientId}:`, error.message);
      throw error;
    }
  }

  async getClientStatus(clientId) {
    try {
      const response = await axios.get(`${BASE_URL}/sessions/${clientId}/status`);
      return response.data;
    } catch (error) {
      console.error(`Error obteniendo estado de ${clientId}:`, error.message);
      throw error;
    }
  }

  async removeClient(clientId) {
    try {
      await axios.delete(`${BASE_URL}/sessions/${clientId}`);
      this.clients.delete(clientId);
    } catch (error) {
      console.error(`Error eliminando cliente ${clientId}:`, error.message);
      throw error;
    }
  }

  async listClients() {
    try {
      const response = await axios.get(`${BASE_URL}/sessions`);
      return response.data;
    } catch (error) {
      console.error('Error listando clientes:', error.message);
      throw error;
    }
  }
}

// Uso
(async () => {
  const manager = new WhatsAppMultiClient();

  // Crear clientes
  await manager.createClient('empresa1');
  await manager.createClient('empresa2');
  await manager.createClient('empresa3');

  // Enviar mensajes
  await manager.sendMessage('empresa1', '573001234567', 'Hola desde empresa1');
  await manager.sendMessage('empresa2', '573007654321', 'Hola desde empresa2');

  // Ver estado
  const status = await manager.getClientStatus('empresa1');
  console.log('Estado empresa1:', status);

  // Listar todos
  const clients = await manager.listClients();
  console.log('Clientes activos:', clients);
})();
```

### Ejemplo 8: Monitoreo y Auto-Recuperación

```javascript
// Node.js - Sistema de monitoreo
const axios = require('axios');
const BASE_URL = 'http://localhost:3000';

class SessionMonitor {
  constructor(checkInterval = 60000) { // 1 minuto
    this.checkInterval = checkInterval;
    this.monitoring = false;
  }

  async checkHealth() {
    try {
      const response = await axios.get(`${BASE_URL}/health`);
      return response.data;
    } catch (error) {
      console.error('Error verificando salud:', error.message);
      return null;
    }
  }

  async checkAllSessions() {
    try {
      const response = await axios.get(`${BASE_URL}/sessions`);
      const sessions = response.data.sessions;

      for (const session of sessions) {
        if (!session.status.connected && session.status.reconnect_attempts >= 5) {
          console.log(`⚠️ Sesión ${session.id} desconectada con muchos reintentos`);
          await this.restartSession(session.id);
        }
      }

      return sessions;
    } catch (error) {
      console.error('Error verificando sesiones:', error.message);
      return [];
    }
  }

  async restartSession(sessionId) {
    try {
      console.log(`🔄 Reiniciando sesión ${sessionId}...`);
      await axios.post(`${BASE_URL}/sessions/${sessionId}/restart`);
      console.log(`✅ Sesión ${sessionId} reiniciada`);
    } catch (error) {
      console.error(`Error reiniciando ${sessionId}:`, error.message);
    }
  }

  start() {
    if (this.monitoring) return;
    
    this.monitoring = true;
    console.log('🔍 Iniciando monitoreo...');

    this.interval = setInterval(async () => {
      const health = await this.checkHealth();
      
      if (health) {
        console.log(`📊 Estado: ${health.connected_sessions}/${health.total_sessions} conectadas`);
        await this.checkAllSessions();
      }
    }, this.checkInterval);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.monitoring = false;
      console.log('🛑 Monitoreo detenido');
    }
  }
}

// Uso
const monitor = new SessionMonitor(60000); // Verificar cada minuto
monitor.start();

// Detener después de 1 hora
setTimeout(() => monitor.stop(), 3600000);
```

### Ejemplo 9: Envío Masivo con Rate Limiting

```javascript
// Node.js - Envío masivo controlado
const axios = require('axios');
const BASE_URL = 'http://localhost:3000';

class BulkSender {
  constructor(sessionId, delayMs = 2000) {
    this.sessionId = sessionId;
    this.delayMs = delayMs;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async sendBulk(contacts, message) {
    const results = {
      success: [],
      failed: []
    };

    console.log(`📤 Enviando a ${contacts.length} contactos...`);

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      
      try {
        await axios.post(
          `${BASE_URL}/sessions/${this.sessionId}/send`,
          {
            number: contact.number,
            message: message.replace('{name}', contact.name)
          }
        );

        results.success.push(contact);
        console.log(`✅ [${i + 1}/${contacts.length}] Enviado a ${contact.name}`);

      } catch (error) {
        results.failed.push({ contact, error: error.message });
        console.error(`❌ [${i + 1}/${contacts.length}] Error con ${contact.name}`);
      }

      // Esperar antes del siguiente envío
      if (i < contacts.length - 1) {
        await this.sleep(this.delayMs);
      }
    }

    return results;
  }
}

// Uso
(async () => {
  const sender = new BulkSender('marketing', 3000); // 3 segundos entre mensajes

  const contacts = [
    { name: 'Juan', number: '573001111111' },
    { name: 'María', number: '573002222222' },
    { name: 'Pedro', number: '573003333333' },
    { name: 'Ana', number: '573004444444' }
  ];

  const message = 'Hola {name}! Tenemos una promoción especial para ti.';

  const results = await sender.sendBulk(contacts, message);

  console.log('\n📊 Resultados:');
  console.log(`✅ Exitosos: ${results.success.length}`);
  console.log(`❌ Fallidos: ${results.failed.length}`);
})();
```

## Integración con Backend

### Ejemplo 10: API REST Completa

```javascript
// Express.js - API para gestionar sesiones
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const BAILEYS_URL = 'http://localhost:3000';

// Crear sesión para un cliente
app.post('/api/clients/:clientId/whatsapp/connect', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Crear sesión en Baileys
    await axios.post(`${BAILEYS_URL}/sessions/${clientId}`);
    
    // Obtener QR
    const qrResponse = await axios.get(`${BAILEYS_URL}/sessions/${clientId}/qr`);
    
    res.json({
      success: true,
      qr_image: qrResponse.data.qr_image,
      message: 'Escanea el QR en WhatsApp'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Verificar estado de conexión
app.get('/api/clients/:clientId/whatsapp/status', async (req, res) => {
  try {
    const { clientId } = req.params;
    const response = await axios.get(`${BAILEYS_URL}/sessions/${clientId}/status`);
    
    res.json({
      success: true,
      status: response.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Enviar mensaje
app.post('/api/clients/:clientId/whatsapp/send', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { number, message } = req.body;
    
    await axios.post(`${BAILEYS_URL}/sessions/${clientId}/send`, {
      number,
      message
    });
    
    res.json({
      success: true,
      message: 'Mensaje enviado'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Desconectar sesión
app.delete('/api/clients/:clientId/whatsapp', async (req, res) => {
  try {
    const { clientId } = req.params;
    await axios.delete(`${BAILEYS_URL}/sessions/${clientId}`);
    
    res.json({
      success: true,
      message: 'Sesión eliminada'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(4000, () => {
  console.log('API corriendo en puerto 4000');
});
```

### Ejemplo 11: WebSocket para Actualizaciones en Tiempo Real

```javascript
// Node.js - Cliente WebSocket para recibir eventos
const WebSocket = require('ws');

class BaileysEventListener {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.ws = null;
  }

  connect() {
    // Nota: Necesitarías implementar WebSocket en el servidor Baileys
    // Este es un ejemplo de cómo se usaría
    this.ws = new WebSocket(`ws://localhost:3000/ws/${this.sessionId}`);

    this.ws.on('open', () => {
      console.log(`✅ Conectado a eventos de ${this.sessionId}`);
    });

    this.ws.on('message', (data) => {
      const event = JSON.parse(data);
      this.handleEvent(event);
    });

    this.ws.on('error', (error) => {
      console.error('Error WebSocket:', error);
    });

    this.ws.on('close', () => {
      console.log('Conexión cerrada');
    });
  }

  handleEvent(event) {
    switch (event.type) {
      case 'message':
        console.log(`📨 Mensaje de ${event.from}: ${event.text}`);
        break;
      case 'connection':
        console.log(`🔌 Estado de conexión: ${event.status}`);
        break;
      case 'qr':
        console.log(`📱 Nuevo QR generado`);
        break;
      default:
        console.log('Evento:', event);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Uso
const listener = new BaileysEventListener('cliente1');
listener.connect();
```

## Scripts Útiles

### Script de Inicialización Rápida

```bash
#!/bin/bash
# init-sessions.sh

echo "🚀 Inicializando sesiones..."

# Crear sesiones
curl -X POST http://localhost:3000/sessions/ventas
curl -X POST http://localhost:3000/sessions/soporte
curl -X POST http://localhost:3000/sessions/marketing

echo "✅ Sesiones creadas"
echo "📱 Obtén los QR codes:"
echo "   curl http://localhost:3000/sessions/ventas/qr"
echo "   curl http://localhost:3000/sessions/soporte/qr"
echo "   curl http://localhost:3000/sessions/marketing/qr"
```

### Script de Monitoreo

```bash
#!/bin/bash
# monitor.sh

while true; do
  clear
  echo "📊 Estado del Sistema"
  echo "===================="
  curl -s http://localhost:3000/health | jq '.'
  echo ""
  echo "📱 Sesiones Activas"
  echo "===================="
  curl -s http://localhost:3000/sessions | jq '.sessions[] | {id, connected: .status.connected}'
  sleep 10
done
```

## Conclusión

Estos ejemplos cubren los casos de uso más comunes. Para más información, consulta:

- [README.md](README.md) - Documentación completa
- [MIGRATION.md](MIGRATION.md) - Guía de migración