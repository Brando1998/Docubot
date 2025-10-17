import WebSocket from 'ws';

export const connectToBackendWS = (phone: string, sessionId: string = 'default'): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
        const apiUrl = process.env.API_URL || 'http://localhost:8080';
        const wsUrl = apiUrl.replace('http:', 'ws:').replace('https:', 'wss:');
        
        // 🔥 Incluir sessionId en la conexión WebSocket
        const ws = new WebSocket(`${wsUrl}/ws?phone=${phone}&sessionId=${sessionId}`);

        ws.on('open', () => {
            console.log(`✅ Conectado al backend Go (session: ${sessionId}, phone: ${phone})`);
            resolve(ws);
        });

        ws.on('error', (err) => {
            console.error(`❌ Error conectando al backend (session: ${sessionId}):`, err);
            reject(err);
        });

        ws.on('close', () => {
            console.log(`🔌 Conexión WebSocket cerrada (session: ${sessionId})`);
        });

        // 🔥 Manejar mensajes entrantes del backend
        ws.on('message', (data: any) => {
            try {
                const message = JSON.parse(data.toString());
                console.log(`📩 Mensaje del backend recibido (session: ${sessionId}):`, message);
            } catch (error) {
                console.error(`❌ Error parseando mensaje del backend:`, error);
            }
        });
    });
};