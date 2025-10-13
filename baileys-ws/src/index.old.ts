// baileys-ws/src/index.ts - Versión corregida sin bucles infinitos
import "dotenv/config";
import { makeWASocket, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import P from "pino";
import { getAuthState } from "./sessions/auth.js";
import qrcode from "qrcode-terminal";
import QRCode from "qrcode";
import { handleIncomingMessage } from "./handlers/messageHandler.js";
import { connectToBackendWS } from "./websocket/client.js";
import express from 'express';

const app = express();
const PORT = process.env.WS_PORT || 3000;

// Middleware
app.use(express.json());

// Variables globales para mantener estado
let sock: any = null;
let qrCodeData: string = '';
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let isShuttingDown = false;

let currentStatus = {
    connected: false,
    number: '',
    name: '',
    qr_code: '',
    qr_image: '',
    last_disconnect_reason: '',
    reconnect_attempts: 0
};

// =============================================
// ENDPOINTS HTTP PARA EL BACKEND
// =============================================

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'baileys-ws',
        timestamp: new Date().toISOString(),
        whatsapp_connected: currentStatus.connected,
        reconnect_attempts: reconnectAttempts
    });
});

// Status endpoint
app.get('/status', (req, res) => {
    res.json({ 
        status: 'running',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        whatsapp: currentStatus
    });
});

// Endpoint para obtener QR o estado
app.get('/qr', async (req, res) => {
    try {
        if (currentStatus.connected) {
            // Ya hay sesión activa
            res.json({
                status: 'connected',
                message: 'WhatsApp ya está conectado',
                connected: true,
                session_info: {
                    number: currentStatus.number,
                    name: currentStatus.name,
                    last_seen: new Date().toISOString()
                }
            });
        } else if (qrCodeData && qrCodeData !== '') {
            // Hay QR disponible
            const qrImageBase64 = await QRCode.toDataURL(qrCodeData);
            
            res.json({
                status: 'waiting_for_scan',
                message: 'Escanea el código QR en WhatsApp',
                qr_code: qrCodeData,
                qr_image: qrImageBase64,
                connected: false
            });
        } else {
            // Generar nueva sesión si no hay QR ni conexión
            if (!sock || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                console.log('🔄 Iniciando nueva sesión...');
                await restartBaileys();
            }
            
            res.json({
                status: 'initializing',
                message: 'Iniciando sesión de WhatsApp...',
                connected: false,
                reconnect_attempts: reconnectAttempts
            });
        }
    } catch (error: any) {
        console.error('Error en endpoint /qr:', error);
        res.status(500).json({
            error: 'Error generando QR',
            details: error.message
        });
    }
});

// Endpoint para enviar mensaje
app.post('/send', async (req, res) => {
    try {
        const { number, message } = req.body;
        
        if (!sock || !currentStatus.connected) {
            return res.status(400).json({
                error: 'WhatsApp no está conectado'
            });
        }

        const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text: message });
        
        res.json({
            success: true,
            message: 'Mensaje enviado correctamente'
        });
    } catch (error: any) {
        console.error('Error enviando mensaje:', error);
        res.status(500).json({
            error: 'Error enviando mensaje',
            details: error.message
        });
    }
});

// Endpoint para reiniciar/crear nueva sesión
app.post('/restart', async (req, res) => {
    try {
        console.log('🔄 Reiniciando sesión de WhatsApp...');
        reconnectAttempts = 0; // Reset counter on manual restart
        await restartBaileys();
        
        res.json({
            success: true,
            message: 'Sesión reiniciada correctamente',
            status: 'restarting'
        });
    } catch (error: any) {
        console.error('Error reiniciando sesión:', error);
        res.status(500).json({
            error: 'Error reiniciando sesión',
            details: error.message
        });
    }
});

// 🆕 Endpoint para limpiar credenciales manualmente
app.post('/clear-session', async (req, res) => {
    try {
        console.log('🧹 Limpiando credenciales manualmente...');
        
        // Cerrar socket actual si existe
        if (sock) {
            try {
                sock.end();
            } catch (e) {
                console.log('Socket ya cerrado');
            }
        }
        
        // Limpiar credenciales
        await clearAuthState();
        
        // Reset variables
        reconnectAttempts = 0;
        qrCodeData = '';
        currentStatus = {
            connected: false,
            number: '',
            name: '',
            qr_code: '',
            qr_image: '',
            last_disconnect_reason: '',
            reconnect_attempts: 0
        };
        
        res.json({
            success: true,
            message: 'Credenciales limpiadas correctamente. Llama a /restart para comenzar nueva sesión.'
        });
    } catch (error: any) {
        console.error('Error limpiando credenciales:', error);
        res.status(500).json({
            error: 'Error limpiando credenciales',
            details: error.message
        });
    }
});

// =============================================
// FUNCIONES DE BAILEYS CON MANEJO MEJORADO
// =============================================

const startHealthServer = () => {
    app.listen(PORT, () => {
        console.log(`🏥 Baileys HTTP Server running on port ${PORT}`);
    });
};

const restartBaileys = async () => {
    try {
        console.log('🔄 Reiniciando Baileys...');
        
        // Limpiar socket anterior
        if (sock) {
            try {
                sock.end();
            } catch (e) {
                console.log('Socket ya cerrado');
            }
        }
        
        // Reset QR code
        qrCodeData = '';
        currentStatus.qr_code = '';
        currentStatus.qr_image = '';
        
        const { state, saveCreds } = await getAuthState();
        const { version } = await fetchLatestBaileysVersion();

        sock = makeWASocket({
            version,
            logger: P({ level: "silent" }),
            auth: state,
            defaultQueryTimeoutMs: 60000, // 60 segundos timeout
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            markOnlineOnConnect: true
        });

        setupBaileysEvents(sock, saveCreds);
        
    } catch (error) {
        console.error('❌ Error reiniciando Baileys:', error);
        reconnectAttempts++;
        currentStatus.reconnect_attempts = reconnectAttempts;
        
        // Solo reintentar si no hemos excedido el límite
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS && !isShuttingDown) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Backoff exponencial, máx 30s
            console.log(`⏰ Reintentando en ${delay/1000} segundos... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
            setTimeout(() => restartBaileys(), delay);
        } else {
            console.log('❌ Máximo de reintentos alcanzado. Deteniéndose.');
        }
    }
};

const setupBaileysEvents = (socket: any, saveCreds: any) => {
    // Evento de actualización de conexión - MEJORADO
    socket.ev.on("connection.update", async (update: any) => {
        const { connection, lastDisconnect, qr } = update;
        
        console.log('📡 Connection update:', { 
            connection, 
            hasQR: !!qr, 
            errorCode: lastDisconnect?.error?.output?.statusCode,
            reconnectAttempts 
        });
        
        if (qr) {
            qrCodeData = qr;
            qrcode.generate(qr, { small: true });
            console.log('📱 Nuevo QR generado');
            
            // Actualizar estado
            try {
                const qrImageBase64 = await QRCode.toDataURL(qr);
                currentStatus.qr_code = qr;
                currentStatus.qr_image = qrImageBase64;
            } catch (error) {
                console.error('Error generando QR image:', error);
            }
        }
        
        if (connection === "open") {
            console.log("✅ Conexión WhatsApp establecida");
            
            // Reset counters on successful connection
            reconnectAttempts = 0;
            currentStatus.reconnect_attempts = 0;
            
            // Actualizar estado
            currentStatus.connected = true;
            currentStatus.number = socket.user?.id || '';
            currentStatus.name = socket.user?.name || 'Bot Docubot';
            qrCodeData = ''; // Limpiar QR
            
        } else if (connection === "close") {
            console.log("❌ Conexión WhatsApp cerrada");
            currentStatus.connected = false;
            
            // ANÁLISIS MEJORADO DE LA DESCONEXIÓN
            const shouldReconnect = lastDisconnect?.error ? 
                await handleDisconnection(lastDisconnect.error) : false;
            
            if (shouldReconnect && !isShuttingDown && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                currentStatus.reconnect_attempts = reconnectAttempts;
                
                const delay = Math.min(3000 * reconnectAttempts, 30000); // Backoff progressive
                console.log(`⏰ Reintentando conexión en ${delay/1000} segundos... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
                setTimeout(() => restartBaileys(), delay);
            } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                console.log('❌ Máximo de reintentos alcanzado. Para reiniciar manualmente, llama al endpoint /restart');
            }
        }
    });

    // Guardar credenciales
    socket.ev.on("creds.update", saveCreds);
    
    // Manejar mensajes entrantes
    socket.ev.on("messages.upsert", async ({ messages }: any) => {
        for (const msg of messages) {
            if (!msg.message) continue;
            const from = msg.key.remoteJid;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
            const bot_number = socket.user!.id;

            if (!from || !text || msg.key.fromMe) continue;

            console.log('📨 Mensaje recibido de', from, ':', text);

            try {
                // Conectar al backend si no está conectado
                const backendWS = await connectToBackendWS(bot_number);
                await handleIncomingMessage(from, text, bot_number, backendWS);
                console.log('✅ Mensaje enviado al backend');
            } catch (error) {
                console.error('❌ Error enviando mensaje al backend:', error);
            }
        }
    });
};

// FUNCIÓN PARA LIMPIAR CREDENCIALES CORRUPTAS
const clearAuthState = async (): Promise<void> => {
    try {
        console.log('🧹 Limpiando credenciales corruptas...');
        
        // Importar módulos de manera dinámica
        const { existsSync, readdirSync, unlinkSync, rmSync } = await import('fs');
        const { join } = await import('path');
        
        const authPath = './auth';
        const sessionPath = './src/sessions';
        
        // Limpiar directorio auth
        if (existsSync(authPath)) {
            try {
                const files = readdirSync(authPath);
                for (const file of files) {
                    const filePath = join(authPath, file);
                    try {
                        unlinkSync(filePath);
                        console.log(`🗑️ Eliminado: ${filePath}`);
                    } catch (e) {
                        console.log(`⚠️ No se pudo eliminar ${filePath}:`, e);
                    }
                }
            } catch (e) {
                console.log('⚠️ Error leyendo directorio auth:', e);
            }
        }
        
        // Limpiar directorio sessions si existe
        if (existsSync(sessionPath)) {
            try {
                const files = readdirSync(sessionPath);
                for (const file of files) {
                    const filePath = join(sessionPath, file);
                    try {
                        unlinkSync(filePath);
                        console.log(`🗑️ Eliminado: ${filePath}`);
                    } catch (e) {
                        console.log(`⚠️ No se pudo eliminar ${filePath}:`, e);
                    }
                }
            } catch (e) {
                console.log('⚠️ Error leyendo directorio sessions:', e);
            }
        }
        
        console.log('✅ Credenciales limpiadas exitosamente');
        
        // Reset variables globales
        qrCodeData = '';
        currentStatus.qr_code = '';
        currentStatus.qr_image = '';
        currentStatus.last_disconnect_reason = '';
        
    } catch (error) {
        console.error('❌ Error limpiando credenciales:', error);
    }
};

// FUNCIÓN PARA ANALIZAR ERRORES DE DESCONEXIÓN - CORREGIDA
const handleDisconnection = async (error: any): Promise<boolean> => {
    const boom = error as Boom;
    const statusCode = boom?.output?.statusCode;
    
    currentStatus.last_disconnect_reason = `${statusCode}: ${boom?.message}`;
    
    console.log('🔍 Analizando desconexión:', {
        statusCode,
        message: boom?.message,
        reconnectAttempts
    });
    
    switch (statusCode) {
        case 401: // CORREGIDO: 401 = Credenciales corruptas/BadSession
            console.log('🗑️ Error 401: Credenciales corruptas - limpiando automáticamente');
            await clearAuthState();
            return true; // Reintentar con credenciales limpias
            
        case DisconnectReason.badSession:
            console.log('🗑️ Sesión inválida detectada - limpiando credenciales');
            await clearAuthState();
            return true; // Reintentar con credenciales limpias
            
        case DisconnectReason.connectionClosed:
            console.log('🔌 Conexión cerrada normalmente');
            return true; // Seguro reintentar
            
        case DisconnectReason.connectionLost:
            console.log('📡 Conexión perdida - reintentando');
            return true; // Seguro reintentar
            
        case DisconnectReason.connectionReplaced:
            console.log('🔄 Conexión reemplazada por otra sesión');
            return false; // No reintentar automáticamente
            
        case 403: // CORREGIDO: 403 = Logout manual real
        case DisconnectReason.loggedOut:
            console.log('👋 Logout manual detectado (403)');
            return false; // No reintentar
            
        case DisconnectReason.restartRequired:
            console.log('♻️ Reinicio requerido');
            return true; // Seguro reintentar
            
        case DisconnectReason.timedOut:
            console.log('⏰ Timeout - reintentando');
            return true; // Seguro reintentar
            
        default:
            console.log(`❓ Código de desconexión desconocido: ${statusCode}`);
            // Para códigos desconocidos, limpiar credenciales por seguridad si es 4xx
            if (statusCode >= 400 && statusCode < 500) {
                console.log('🧹 Error 4xx detectado - limpiando credenciales por seguridad');
                await clearAuthState();
            }
            return true; // Reintentar por defecto, pero con límite
    }
};

// =============================================
// INICIALIZACIÓN
// =============================================

const start = async () => {
    try {
        // 1. Iniciar servidor HTTP
        startHealthServer();
        
        // 2. Iniciar Baileys (solo si no estamos en shutdown)
        if (!isShuttingDown) {
            await restartBaileys();
        }
        
        console.log('🚀 Baileys-WS iniciado correctamente');
        
    } catch (error) {
        console.error("❌ Error iniciando aplicación:", error);
        process.exit(1);
    }
};

// Manejar cierre graceful
process.on('SIGINT', async () => {
    console.log('🛑 Cerrando Baileys...');
    isShuttingDown = true;
    
    if (sock) {
        try {
            await sock.logout();
        } catch (e) {
            console.log('Error durante logout:', e);
        }
        sock.end();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM recibido, cerrando...');
    isShuttingDown = true;
    
    if (sock) {
        try {
            await sock.logout();
        } catch (e) {
            console.log('Error durante logout:', e);
        }
        sock.end();
    }
    process.exit(0);
});

start();