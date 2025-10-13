// baileys-ws/src/index.ts - Versión con soporte para múltiples sesiones
import "dotenv/config";
import express from 'express';
import { SessionManager } from "./managers/SessionManager.js";
import type { SessionConfig } from "./types/session.types.js";

const app = express();
const PORT = process.env.WS_PORT || 3000;

// Middleware
app.use(express.json());

// Configuración del gestor de sesiones
const sessionConfig: Partial<SessionConfig> = {
    maxReconnectAttempts: parseInt(process.env.MAX_RECONNECT_ATTEMPTS || '5'),
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '1800000'), // 30 minutos
    maxSessions: parseInt(process.env.MAX_SESSIONS || '10'),
    cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || '300000') // 5 minutos
};

const sessionManager = new SessionManager(sessionConfig);

// =============================================
// ENDPOINTS HTTP PARA EL BACKEND
// =============================================

// Health check endpoint
app.get('/health', (req, res) => {
    const stats = sessionManager.getStats();
    res.json({ 
        status: 'ok', 
        service: 'baileys-ws',
        timestamp: new Date().toISOString(),
        ...stats
    });
});

// Status endpoint general
app.get('/status', (req, res) => {
    const stats = sessionManager.getStats();
    res.json({ 
        status: 'running',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        sessions: stats
    });
});

// Listar todas las sesiones
app.get('/sessions', (req, res) => {
    const sessions = sessionManager.getAllSessions();
    const sessionList = Array.from(sessions.entries()).map(([id, session]) => ({
        id,
        status: session.status,
        has_qr: session.qrCodeData !== ''
    }));
    
    res.json({
        total: sessionList.length,
        sessions: sessionList
    });
});

// Crear nueva sesión
app.post('/sessions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        if (!sessionId || sessionId.trim() === '') {
            return res.status(400).json({
                error: 'sessionId es requerido'
            });
        }

        const session = await sessionManager.createSession(sessionId);
        
        res.json({
            success: true,
            message: 'Sesión creada correctamente',
            session: {
                id: session.id,
                status: session.status
            }
        });
    } catch (error: any) {
        console.error('Error creando sesión:', error);
        res.status(500).json({
            error: 'Error creando sesión',
            details: error.message
        });
    }
});

// Obtener QR o estado de una sesión específica
app.get('/sessions/:sessionId/qr', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = sessionManager.getSession(sessionId);

        if (!session) {
            return res.status(404).json({
                error: 'Sesión no encontrada',
                message: `La sesión ${sessionId} no existe. Créala primero con POST /sessions/${sessionId}`
            });
        }

        if (session.status.connected) {
            res.json({
                status: 'connected',
                message: 'WhatsApp ya está conectado',
                connected: true,
                session_info: {
                    id: sessionId,
                    number: session.status.number,
                    name: session.status.name,
                    last_activity: session.status.last_activity
                }
            });
        } else if (session.qrCodeData && session.qrCodeData !== '') {
            res.json({
                status: 'waiting_for_scan',
                message: 'Escanea el código QR en WhatsApp',
                qr_code: session.qrCodeData,
                qr_image: session.status.qr_image,
                connected: false,
                session_id: sessionId
            });
        } else {
            res.json({
                status: 'initializing',
                message: 'Iniciando sesión de WhatsApp...',
                connected: false,
                reconnect_attempts: session.reconnectAttempts,
                session_id: sessionId
            });
        }
    } catch (error: any) {
        console.error('Error en endpoint /sessions/:sessionId/qr:', error);
        res.status(500).json({
            error: 'Error obteniendo QR',
            details: error.message
        });
    }
});

// Obtener estado de una sesión específica
app.get('/sessions/:sessionId/status', (req, res) => {
    try {
        const { sessionId } = req.params;
        const status = sessionManager.getSessionStatus(sessionId);

        if (!status) {
            return res.status(404).json({
                error: 'Sesión no encontrada'
            });
        }

        res.json({
            session_id: sessionId,
            status
        });
    } catch (error: any) {
        console.error('Error obteniendo estado:', error);
        res.status(500).json({
            error: 'Error obteniendo estado',
            details: error.message
        });
    }
});

// Enviar mensaje desde una sesión específica
app.post('/sessions/:sessionId/send', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { number, message } = req.body;
        
        if (!number || !message) {
            return res.status(400).json({
                error: 'number y message son requeridos'
            });
        }

        await sessionManager.sendMessage(sessionId, number, message);
        
        res.json({
            success: true,
            message: 'Mensaje enviado correctamente',
            session_id: sessionId
        });
    } catch (error: any) {
        console.error('Error enviando mensaje:', error);
        res.status(500).json({
            error: 'Error enviando mensaje',
            details: error.message
        });
    }
});

// Reiniciar una sesión específica
app.post('/sessions/:sessionId/restart', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        await sessionManager.restartSession(sessionId);
        
        res.json({
            success: true,
            message: 'Sesión reiniciada correctamente',
            session_id: sessionId
        });
    } catch (error: any) {
        console.error('Error reiniciando sesión:', error);
        res.status(500).json({
            error: 'Error reiniciando sesión',
            details: error.message
        });
    }
});

// Eliminar una sesión específica
app.delete('/sessions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        await sessionManager.removeSession(sessionId);

        res.json({
            success: true,
            message: 'Sesión eliminada correctamente',
            session_id: sessionId
        });
    } catch (error: any) {
        console.error('Error eliminando sesión:', error);
        res.status(500).json({
            error: 'Error eliminando sesión',
            details: error.message
        });
    }
});

// Obtener lista de chats de una sesión específica
app.get('/sessions/:sessionId/chats', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = sessionManager.getSession(sessionId);

        if (!session) {
            return res.status(404).json({
                error: 'Sesión no encontrada'
            });
        }

        if (!session.socket || !session.status.connected) {
            return res.status(400).json({
                error: 'Sesión no conectada',
                message: 'La sesión debe estar conectada para obtener chats'
            });
        }

        // Obtener chats desde WhatsApp
        const chats = await session.socket.store?.chats || [];

        // Formatear respuesta
        const formattedChats = chats.map((chat: any) => ({
            id: chat.id,
            name: chat.name || chat.notify || 'Sin nombre',
            isGroup: chat.id.endsWith('@g.us'),
            unreadCount: chat.unreadCount || 0,
            lastMessage: chat.messages?.length > 0 ? {
                text: chat.messages[chat.messages.length - 1]?.message?.conversation ||
                      chat.messages[chat.messages.length - 1]?.message?.extendedTextMessage?.text || '',
                timestamp: chat.messages[chat.messages.length - 1]?.messageTimestamp,
                fromMe: chat.messages[chat.messages.length - 1]?.key?.fromMe || false
            } : null,
            pinned: chat.pinned || false,
            archived: chat.archived || false
        }));

        res.json({
            session_id: sessionId,
            total_chats: formattedChats.length,
            chats: formattedChats
        });
    } catch (error: any) {
        console.error('Error obteniendo chats:', error);
        res.status(500).json({
            error: 'Error obteniendo chats',
            details: error.message
        });
    }
});

// Obtener mensajes de un chat específico
app.get('/sessions/:sessionId/chats/:chatId/messages', async (req, res) => {
    try {
        const { sessionId, chatId } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;
        const session = sessionManager.getSession(sessionId);

        if (!session) {
            return res.status(404).json({
                error: 'Sesión no encontrada'
            });
        }

        if (!session.socket || !session.status.connected) {
            return res.status(400).json({
                error: 'Sesión no conectada'
            });
        }

        // Obtener mensajes del chat
        const messages = await session.socket.store?.messages?.[chatId] || [];
        const recentMessages = Object.values(messages)
            .sort((a: any, b: any) => (b.messageTimestamp || 0) - (a.messageTimestamp || 0))
            .slice(0, limit);

        // Formatear mensajes
        const formattedMessages = recentMessages.map((msg: any) => ({
            id: msg.key?.id,
            from: msg.key?.remoteJid,
            fromMe: msg.key?.fromMe || false,
            text: msg.message?.conversation ||
                  msg.message?.extendedTextMessage?.text ||
                  msg.message?.imageMessage?.caption || '',
            timestamp: msg.messageTimestamp,
            type: msg.message ? Object.keys(msg.message)[0] : 'unknown',
            hasMedia: !!(msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.audioMessage || msg.message?.documentMessage)
        }));

        res.json({
            session_id: sessionId,
            chat_id: chatId,
            total_messages: formattedMessages.length,
            messages: formattedMessages.reverse() // Más antiguos primero
        });
    } catch (error: any) {
        console.error('Error obteniendo mensajes:', error);
        res.status(500).json({
            error: 'Error obteniendo mensajes',
            details: error.message
        });
    }
});

// =============================================
// INICIALIZACIÓN
// =============================================

const start = async () => {
    try {
        // Iniciar servidor HTTP
        app.listen(PORT, () => {
            console.log(`🚀 Baileys-WS Multi-Session Server running on port ${PORT}`);
            console.log(`📊 Max sessions: ${sessionConfig.maxSessions}`);
            console.log(`⏱️  Session timeout: ${sessionConfig.sessionTimeout}ms`);
            console.log(`🧹 Cleanup interval: ${sessionConfig.cleanupInterval}ms`);
        });
        
        console.log('✅ Baileys-WS Multi-Session iniciado correctamente');
        
    } catch (error) {
        console.error("❌ Error iniciando aplicación:", error);
        process.exit(1);
    }
};

// Manejar cierre graceful
process.on('SIGINT', async () => {
    console.log('🛑 Cerrando Baileys-WS...');
    await sessionManager.cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM recibido, cerrando...');
    await sessionManager.cleanup();
    process.exit(0);
});

start();