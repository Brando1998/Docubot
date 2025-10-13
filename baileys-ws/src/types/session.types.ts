// src/types/session.types.ts
import type { WASocket } from "@whiskeysockets/baileys";

export interface SessionStatus {
    connected: boolean;
    number: string;
    name: string;
    qr_code: string;
    qr_image: string;
    last_disconnect_reason: string;
    reconnect_attempts: number;
    created_at: Date;
    last_activity: Date;
}

export interface SessionData {
    id: string;
    socket: WASocket | null;
    status: SessionStatus;
    qrCodeData: string;
    reconnectAttempts: number;
    isShuttingDown: boolean;
    backendWS: any | null;
}

export interface SessionConfig {
    maxReconnectAttempts: number;
    sessionTimeout: number; // milliseconds
    maxSessions: number;
    cleanupInterval: number; // milliseconds
}

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
    maxReconnectAttempts: 5,
    sessionTimeout: 30 * 60 * 1000, // 30 minutos
    maxSessions: 10,
    cleanupInterval: 5 * 60 * 1000 // 5 minutos
};