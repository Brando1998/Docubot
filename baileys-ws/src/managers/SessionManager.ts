// src/managers/SessionManager.ts
import { makeWASocket, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import type { WASocket } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import P from "pino";
import qrcode from "qrcode-terminal";
import QRCode from "qrcode";
import { getAuthState, clearAuthState } from "../sessions/auth.js";
import type { SessionData, SessionStatus, SessionConfig } from "../types/session.types.js";
import { DEFAULT_SESSION_CONFIG } from "../types/session.types.js";

export class SessionManager {
    private sessions: Map<string, SessionData>;
    private config: SessionConfig;
    private cleanupInterval: NodeJS.Timeout | null;

    constructor(config: Partial<SessionConfig> = {}) {
        this.sessions = new Map();
        this.config = { ...DEFAULT_SESSION_CONFIG, ...config };
        this.cleanupInterval = null;
        this.startCleanupTask();
    }

    /**
     * Inicia una tarea de limpieza periódica para sesiones inactivas
     */
    private startCleanupTask(): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanupInactiveSessions();
        }, this.config.cleanupInterval);
    }

    /**
     * Limpia sesiones inactivas basándose en el timeout configurado
     */
    private cleanupInactiveSessions(): void {
        const now = Date.now();
        const sessionsToRemove: string[] = [];

        for (const [sessionId, session] of this.sessions.entries()) {
            const inactiveTime = now - session.status.last_activity.getTime();
            
            if (!session.status.connected && inactiveTime > this.config.sessionTimeout) {
                console.log(`🧹 Limpiando sesión inactiva: ${sessionId}`);
                sessionsToRemove.push(sessionId);
            }
        }

        for (const sessionId of sessionsToRemove) {
            this.removeSession(sessionId);
        }
    }

    /**
     * Crea una nueva sesión
     */
    async createSession(sessionId: string): Promise<SessionData> {
        // Verificar límite de sesiones
        if (this.sessions.size >= this.config.maxSessions) {
            throw new Error(`Límite de sesiones alcanzado (${this.config.maxSessions})`);
        }

        // Verificar si la sesión ya existe
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

    /**
     * Inicia la conexión de WhatsApp para una sesión
     */
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

    /**
     * Configura los eventos del socket de WhatsApp
     */
    private setupSocketEvents(sessionId: string, socket: WASocket, saveCreds: any): void {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        // Evento de actualización de conexión
        socket.ev.on("connection.update", async (update: any) => {
            const { connection, lastDisconnect, qr } = update;
            
            console.log(`📡 [${sessionId}] Connection update:`, { 
                connection, 
                hasQR: !!qr,
                errorCode: lastDisconnect?.error?.output?.statusCode
            });

            if (qr) {
                session.qrCodeData = qr;
                qrcode.generate(qr, { small: true });
                console.log(`📱 [${sessionId}] Nuevo QR generado`);

                try {
                    const qrImageBase64 = await QRCode.toDataURL(qr);
                    session.status.qr_code = qr;
                    session.status.qr_image = qrImageBase64;
                } catch (error) {
                    console.error(`Error generando QR image para ${sessionId}:`, error);
                }
            }

            if (connection === "open") {
                console.log(`✅ [${sessionId}] Conexión WhatsApp establecida`);
                
                session.reconnectAttempts = 0;
                session.status.reconnect_attempts = 0;
                session.status.connected = true;
                session.status.number = socket.user?.id || '';
                session.status.name = socket.user?.name || `Bot ${sessionId}`;
                session.status.last_activity = new Date();
                session.qrCodeData = '';
                
            } else if (connection === "close") {
                console.log(`❌ [${sessionId}] Conexión WhatsApp cerrada`);
                session.status.connected = false;
                session.status.last_activity = new Date();

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

        // Guardar credenciales
        socket.ev.on("creds.update", saveCreds);

        // Manejar mensajes entrantes
        socket.ev.on("messages.upsert", async ({ messages }: any) => {
            for (const msg of messages) {
                if (!msg.message) continue;
                const from = msg.key.remoteJid;

                // Determinar el tipo de mensaje
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

                // Enviar al backend si hay conexión WebSocket
                if (session.backendWS && session.backendWS.readyState === 1) {
                    try {
                        const { handleIncomingMessage } = await import('../handlers/messageHandler.js');
                        await handleIncomingMessage(from, text, session.status.number, session.backendWS, messageType);
                    } catch (error) {
                        console.error(`Error enviando mensaje al backend: ${error}`);
                    }
                }
            }
        });
    }

    /**
     * Maneja la desconexión de una sesión
     */
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

    /**
     * Obtiene una sesión por ID
     */
    getSession(sessionId: string): SessionData | undefined {
        return this.sessions.get(sessionId);
    }

    /**
     * Obtiene todas las sesiones
     */
    getAllSessions(): Map<string, SessionData> {
        return this.sessions;
    }

    /**
     * Obtiene el estado de una sesión
     */
    getSessionStatus(sessionId: string): SessionStatus | undefined {
        const session = this.sessions.get(sessionId);
        return session?.status;
    }

    /**
     * Envía un mensaje desde una sesión específica
     */
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

    /**
     * Reinicia una sesión
     */
    async restartSession(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            throw new Error(`Sesión ${sessionId} no encontrada`);
        }

        console.log(`🔄 [${sessionId}] Reiniciando sesión...`);

        // Cerrar socket actual
        if (session.socket) {
            try {
                session.socket.end(undefined);
            } catch (e) {
                console.log(`[${sessionId}] Socket ya cerrado`);
            }
        }

        // Reset estado
        session.reconnectAttempts = 0;
        session.qrCodeData = '';
        session.status.qr_code = '';
        session.status.qr_image = '';
        session.status.reconnect_attempts = 0;

        // Reiniciar conexión
        await this.startWhatsAppConnection(sessionId);
    }

    /**
     * Elimina una sesión
     */
    async removeSession(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            return;
        }

        console.log(`🗑️ [${sessionId}] Eliminando sesión...`);
        
        session.isShuttingDown = true;

        // Cerrar socket
        if (session.socket) {
            try {
                await session.socket.logout();
            } catch (e) {
                console.log(`[${sessionId}] Error durante logout:`, e);
            }
            session.socket.end(undefined);
        }

        // Cerrar WebSocket del backend si existe
        if (session.backendWS) {
            try {
                session.backendWS.close();
            } catch (e) {
                console.log(`[${sessionId}] Error cerrando backend WS:`, e);
            }
        }

        // Limpiar credenciales
        await clearAuthState(sessionId);

        // Eliminar del mapa
        this.sessions.delete(sessionId);
        
        console.log(`✅ [${sessionId}] Sesión eliminada`);
    }

    /**
     * Limpia todas las sesiones
     */
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

    /**
     * Obtiene estadísticas del gestor de sesiones
     */
    getStats() {
        const sessions = Array.from(this.sessions.values());
        
        return {
            total_sessions: sessions.length,
            connected_sessions: sessions.filter(s => s.status.connected).length,
            disconnected_sessions: sessions.filter(s => !s.status.connected).length,
            max_sessions: this.config.maxSessions,
            sessions_with_qr: sessions.filter(s => s.qrCodeData !== '').length,
            memory_usage: process.memoryUsage(),
            uptime: process.uptime()
        };
    }
}