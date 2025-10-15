import { WebSocket } from 'ws';

export const handleIncomingMessage = async (
    from: string,
    text: string,
    botNumber: string,
    backendWS: WebSocket,
    messageType?: string
) => {
    // Enviar mensaje al backend Go
    backendWS.send(JSON.stringify({
        phone: from,
        message: text,
        botNumber,
        messageType: messageType || 'text'
    }));

    console.log(`Mensaje enviado al backend: ${from} - ${text} (tipo: ${messageType || 'text'})`);
};