package controllers

import (
	"fmt"
	"log"
	"strings"
	"sync"

	"github.com/gorilla/websocket"
)

type WebSocketHub struct {
	mu      sync.RWMutex
	bots    map[string]*websocket.Conn // Conexiones de bots (key: sessionId:botPhone o botPhone)
	clients map[string]*websocket.Conn // Conexiones de clientes (key: client phone number)
}

type Client struct {
	Phone string
	Conn  *websocket.Conn
}

func NewWebSocketHub() *WebSocketHub {
	return &WebSocketHub{
		bots:    make(map[string]*websocket.Conn),
		clients: make(map[string]*websocket.Conn),
	}
}

// Métodos para Bots
func (h *WebSocketHub) RegisterBot(botPhone string, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if existing, exists := h.bots[botPhone]; exists {
		log.Printf("Conexión existente para bot %s, cerrando...", botPhone)
		existing.Close()
	}
	print("REGISTRANDO")
	println(botPhone)
	h.bots[botPhone] = conn
	log.Printf("Bot %s registrado exitosamente", botPhone)
}

func (h *WebSocketHub) UnregisterBot(botPhone string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if conn, ok := h.bots[botPhone]; ok {
		conn.Close()
		delete(h.bots, botPhone)
	}
}

func (h *WebSocketHub) SendToBot(botPhone string, message interface{}) error {
	h.mu.RLock()
	defer h.mu.RUnlock()
	println(botPhone)
	if conn, ok := h.bots[botPhone]; ok {
		return conn.WriteJSON(message)
	}
	return fmt.Errorf("bot not found")
}

func (h *WebSocketHub) ListBots() []string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	var bots []string
	for bot := range h.bots {
		bots = append(bots, bot)
	}
	return bots
}

// GetBotsBySession obtiene todos los bots de una sesión específica
func (h *WebSocketHub) GetBotsBySession(sessionId string) []string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	var bots []string
	prefix := sessionId + ":"
	for botKey := range h.bots {
		if strings.HasPrefix(botKey, prefix) {
			// Extraer el número de teléfono del bot
			parts := strings.Split(botKey, ":")
			if len(parts) >= 2 {
				bots = append(bots, parts[1])
			}
		}
	}
	return bots
}

// Método para obtener conexión de bot
func (h *WebSocketHub) GetBotConnection(botPhone string) (*websocket.Conn, error) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if conn, ok := h.bots[botPhone]; ok {
		return conn, nil
	}
	return nil, fmt.Errorf("bot not found")
}
