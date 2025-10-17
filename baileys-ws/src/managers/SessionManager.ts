// src/managers/SessionManager.ts
import { makeWASocket, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import type { WASocket } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import P from "pino";
import QRCode from "qrcode";
import { getAuthState, clearAuthState } from "../sessions/auth.js";
import type { SessionData, SessionConfig, SessionStatus } from "../types/session.types.js";
import { connectToBackendWS } from "../websocket/client.js";

export class SessionManager {
    private sessions: Map<string, SessionData>;
    private config: SessionConfig;
    private cleanupInterval?: NodeJS.Timeout;

    constructor(config: Partial<SessionConfig> = {}) {
        this.sessions = new Map();
        this.config = {
            maxReconnectAttempts: config.maxReconnectAttempts || 5,
            sessionTimeout: config.sessionTimeout || 1800000,
            maxSessions: config.maxSessions || 10,
            cleanupInterval: config.cleanupInterval || 300000
        };

        this.startCleanupInterval();
    }

    private startCleanupInterval(): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanupInactiveSessions();
        }, this.config.cleanupInterval);
    }

    private cleanupInactiveSessions(): void {
        const now = Date.now();
        const sessionsToRemove: string[] = [];

        for (const [sessionId, session] of this.sessions.entries()) {
            const inactiveTime = now - session.status.last_activity.getTime();
            
            if (inactiveTime > this.config.sessionTimeout && !session.status.connected) {
                console.log(`🧹 Limpiando sesión inactiva: ${sessionId} (inactiva por ${Math.floor(inactiveTime/1000/60)} minutos)`);
                sessionsToRemove.push(sessionId);
            }
        }

        for (const sessionId of sessionsToRemove) {
            this.removeSession(sessionId);
        }
    }

    async createSession(sessionId: string): Promise<SessionData> {
        if (this.sessions.size >= this.config.maxSessions) {
            throw new Error(`Límite de sesiones alcanzado (${this.config.maxSessions})`);
        }

        if (this.sessions.has(sessionId)) {
            throw new Error(`La sesión ${sessionId} ya existe`);
        }

        const sessionData: SessionData = {
            id: sessionId,
            socket: null,
            status: {
                connected: false,
                number: '',
                name: '',
                qr_code: '',
                qr_image: '',
                last_disconnect_reason: '',
                reconnect_attempts: 0,
                created_at: new Date(),
                last_activity: new Date()
            },
            qrCodeData: '',
            reconnectAttempts: 0,
            isShuttingDown: false,
            backendWS: null
        };

        this.sessions.set(sessionId, sessionData);
        console.log(`✅ Sesión creada: ${sessionId}`);

        // Iniciar conexión de WhatsApp
        await this.startWhatsAppConnection(sessionId);

        return sessionData;
    }

    private async startWhatsAppConnection(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Sesión ${sessionId} no encontrada`);
        }

        try {
            console.log(`🔄 Iniciando conexión WhatsApp para sesión: ${sessionId}`);

            const { state, saveCreds } = await getAuthState(sessionId);
            const { version } = await fetchLatestBaileysVersion();

            const socket = makeWASocket({
                version,
                logger: P({ level: "silent" }),
                auth: state,
                defaultQueryTimeoutMs: 60000,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
                markOnlineOnConnect: true
            });

            session.socket = socket;
            this.setupSocketEvents(sessionId, socket, saveCreds);

        } catch (error) {
            console.error(`❌ Error iniciando conexión para ${sessionId}:`, error);
            session.reconnectAttempts++;
            
            if (session.reconnectAttempts < this.config.maxReconnectAttempts) {
                const delay = Math.min(1000 * Math.pow(2, session.reconnectAttempts), 30000);
                console.log(`⏰ Reintentando en ${delay/1000}s... (${session.reconnectAttempts}/${this.config.maxReconnectAttempts})`);
                setTimeout(() => this.startWhatsAppConnection(sessionId), delay);
            }
        }
    }

    private setupSocketEvents(sessionId: string, socket: WASocket, saveCreds: any): void {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        socket.ev.on("connection.update", async (update: any) => {
            const { connection, lastDisconnect, qr } = update;
            
            console.log(`📡 [${sessionId}] Connection update:`, { 
                connection, 
                hasQR: !!qr, 
                errorCode: lastDisconnect?.error?.output?.statusCode 
            });

            // Manejar QR
            if (qr) {
                session.qrCodeData = qr;
                session.status.qr_code = qr;
                
                try {
                    const qrImage = await QRCode.toDataURL(qr);
                    session.status.qr_image = qrImage;
                    console.log(`📱 [${sessionId}] QR Code generado`);
                } catch (error) {
                    console.error(`❌ [${sessionId}] Error generando QR image:`, error);
                }
            }

            // Manejar conexión establecida
            if (connection === 'open') {
                session.status.connected = true;
                session.status.number = socket.user?.id.split(':')[0] || '';
                session.status.name = socket.user?.name || '';
                session.reconnectAttempts = 0;
                session.status.reconnect_attempts = 0;
                session.qrCodeData = '';
                session.status.qr_code = '';
                
                console.log(`✅ [${sessionId}] Conexión WhatsApp establecida`);
                console.log(`📱 [${sessionId}] Número: ${session.status.number}`);

                // 🔥 CONECTAR AL BACKEND WEBSOCKET AQUÍ
                try {
                    console.log(`🔌 [${sessionId}] Conectando al backend WebSocket...`);
                    session.backendWS = await connectToBackendWS(session.status.number, sessionId);
                    console.log(`✅ [${sessionId}] Conectado al backend WebSocket`);
                } catch (error) {
                    console.error(`❌ [${sessionId}] Error conectando al backend:`, error);
                }
            }

            // Manejar desconexión
            if (connection === 'close') {
                session.status.connected = false;
                session.qrCodeData = '';
                
                // Cerrar WebSocket del backend
                if (session.backendWS) {
                    try {
                        session.backendWS.close();
                        session.backendWS = null;
                        console.log(`🔌 [${sessionId}] WebSocket del backend cerrado`);
                    } catch (error) {
                        console.error(`❌ [${sessionId}] Error cerrando backend WS:`, error);
                    }
                }

                const shouldReconnect = lastDisconnect?.error ? 
                    await this.handleDisconnection(sessionId, lastDisconnect.error) : false;

                if (shouldReconnect && !session.isShuttingDown && 
                    session.reconnectAttempts < this.config.maxReconnectAttempts) {
                    session.reconnectAttempts++;
                    session.status.reconnect_attempts = session.reconnectAttempts;

                    const delay = Math.min(3000 * session.reconnectAttempts, 30000);
                    console.log(`⏰ [${sessionId}] Reintentando en ${delay/1000}s... (${session.reconnectAttempts}/${this.config.maxReconnectAttempts})`);
                    setTimeout(() => this.startWhatsAppConnection(sessionId), delay);
                }
            }
        });

        socket.ev.on("creds.update", saveCreds);

        socket.ev.on("messages.upsert", async ({ messages }: any) => {
            for (const msg of messages) {
                if (!msg.message) continue;
                const from = msg.key.remoteJid;

                let messageType = 'text';
                let text = '';

                if (msg.message.conversation || msg.message.extendedTextMessage?.text) {
                    text = msg.message.conversation || msg.message.extendedTextMessage?.text;
                    messageType = 'text';
                } else if (msg.message.audioMessage) {
                    text = '[Audio recibido]';
                    messageType = 'audio';
                } else if (msg.message.imageMessage) {
                    text = '[Imagen recibida]';
                    messageType = 'image';
                } else if (msg.message.videoMessage) {
                    text = '[Video recibido]';
                    messageType = 'video';
                } else if (msg.message.documentMessage) {
                    text = '[Documento recibido]';
                    messageType = 'document';
                } else {
                    text = '[Mensaje no soportado]';
                    messageType = 'unknown';
                }

                if (!from || msg.key.fromMe) continue;

                console.log(`📨 [${sessionId}] Mensaje de ${from}: ${text} (tipo: ${messageType})`);
                session.status.last_activity = new Date();

                // 🔥 ENVIAR AL BACKEND
                if (session.backendWS && session.backendWS.readyState === 1) {
                    try {
                        const { handleIncomingMessage } = await import('../handlers/messageHandler.js');
                        await handleIncomingMessage(from, text, session.status.number, session.backendWS, messageType);
                        console.log(`✅ [${sessionId}] Mensaje enviado al backend`);
                    } catch (error) {
                        console.error(`❌ [${sessionId}] Error enviando mensaje al backend:`, error);
                    }
                } else {
                    console.warn(`⚠️ [${sessionId}] Backend WebSocket no disponible (readyState: ${session.backendWS?.readyState || 'null'})`);
                }
            }
        });
    }

    private async handleDisconnection(sessionId: string, error: any): Promise<boolean> {
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        const boom = error as Boom;
        const statusCode = boom?.output?.statusCode;
        
        session.status.last_disconnect_reason = `${statusCode}: ${boom?.message}`;
        
        console.log(`🔍 [${sessionId}] Analizando desconexión:`, {
            statusCode,
            message: boom?.message,
            reconnectAttempts: session.reconnectAttempts
        });

        switch (statusCode) {
            case 401:
            case DisconnectReason.badSession:
                console.log(`🗑️ [${sessionId}] Credenciales corruptas - limpiando`);
                await clearAuthState(sessionId);
                return true;

            case DisconnectReason.connectionClosed:
            case DisconnectReason.connectionLost:
            case DisconnectReason.restartRequired:
            case DisconnectReason.timedOut:
                return true;

            case DisconnectReason.connectionReplaced:
            case 403:
            case DisconnectReason.loggedOut:
                console.log(`👋 [${sessionId}] Logout detectado`);
                return false;

            default:
                if (statusCode >= 400 && statusCode < 500) {
                    console.log(`🧹 [${sessionId}] Error 4xx - limpiando credenciales`);
                    await clearAuthState(sessionId);
                }
                return true;
        }
    }

    getSession(sessionId: string): SessionData | undefined {
        return this.sessions.get(sessionId);
    }

    getAllSessions(): Map<string, SessionData> {
        return this.sessions;
    }

    getSessionStatus(sessionId: string): SessionStatus | undefined {
        const session = this.sessions.get(sessionId);
        return session?.status;
    }

    async sendMessage(sessionId: string, number: string, message: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            throw new Error(`Sesión ${sessionId} no encontrada`);
        }

        if (!session.socket || !session.status.connected) {
            throw new Error(`Sesión ${sessionId} no está conectada`);
        }

        const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
        await session.socket.sendMessage(jid, { text: message });
        
        session.status.last_activity = new Date();
        console.log(`✅ [${sessionId}] Mensaje enviado a ${number}`);
    }

    async restartSession(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            throw new Error(`Sesión ${sessionId} no encontrada`);
        }

        console.log(`🔄 [${sessionId}] Reiniciando sesión...`);

        if (session.socket) {
            try {
                session.socket.end(undefined);
            } catch (e) {
                console.log(`[${sessionId}] Socket ya cerrado`);
            }
        }

        if (session.backendWS) {
            try {
                session.backendWS.close();
                session.backendWS = null;
            } catch (e) {
                console.log(`[${sessionId}] Backend WS ya cerrado`);
            }
        }

        session.reconnectAttempts = 0;
        session.qrCodeData = '';
        session.status.qr_code = '';
        session.status.qr_image = '';
        session.status.reconnect_attempts = 0;

        await this.startWhatsAppConnection(sessionId);
    }

    async removeSession(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            return;
        }

        console.log(`🗑️ [${sessionId}] Eliminando sesión...`);
        
        session.isShuttingDown = true;

        if (session.socket) {
            try {
                await session.socket.logout();
            } catch (e) {
                console.log(`[${sessionId}] Error durante logout:`, e);
            }
            session.socket.end(undefined);
        }

        if (session.backendWS) {
            try {
                session.backendWS.close();
            } catch (e) {
                console.log(`[${sessionId}] Error cerrando backend WS:`, e);
            }
        }

        await clearAuthState(sessionId);
        this.sessions.delete(sessionId);
        
        console.log(`✅ [${sessionId}] Sesión eliminada`);
    }

    async cleanup(): Promise<void> {
        console.log('🧹 Limpiando todas las sesiones...');
        
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        const sessionIds = Array.from(this.sessions.keys());
        
        for (const sessionId of sessionIds) {
            await this.removeSession(sessionId);
        }

        console.log('✅ Todas las sesiones limpiadas');
    }

    getStats() {
        const sessions = Array.from(this.sessions.values());
        
        return {
            total_sessions: sessions.length,
            connected_sessions: sessions.filter(s => s.status.connected).length,
            disconnected_sessions: sessions.filter(s => !s.status.connected).length,
            max_sessions: this.config.maxSessions,
            sessions_with_qr: sessions.filter(s => s.qrCodeData !== '').length,
            sessions_with_backend: sessions.filter(s => s.backendWS !== null).length,
            memory_usage: process.memoryUsage(),
            uptime: process.uptime()
        };
    }
}