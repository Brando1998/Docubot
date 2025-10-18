package controllers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	database "github.com/brando1998/docubot-api/databases"
	"github.com/brando1998/docubot-api/models"
	"github.com/brando1998/docubot-api/repositories"
)

var (
	conversationRepo repositories.ConversationRepository
	botRepo          repositories.BotRepository
	clientRepo       repositories.ClientRepository
)

type IncomingMessageRequest struct {
	Phone       string `json:"phone"`
	Message     string `json:"message"`
	BotNumber   string `json:"botNumber"`
	SessionID   string `json:"sessionId,omitempty"`   // ID de la sesión para múltiples bots
	MessageType string `json:"messageType,omitempty"` // Tipo de mensaje (text, audio, image, etc.)
}

type RasaResponseItem struct {
	Text string `json:"text"`
}

// Setters para inyección de dependencias
func SetConversationRepo(repo repositories.ConversationRepository) {
	conversationRepo = repo
}

func SetBotRepo(repo repositories.BotRepository) {
	botRepo = repo
}

func SetClientRepo(repo repositories.ClientRepository) {
	clientRepo = repo
}

// HandleWebSocket maneja conexiones WebSocket entrantes
func HandleWebSocket(c *gin.Context, hub *WebSocketHub, upgrader websocket.Upgrader) {

	//Obtener el numero y sessionId
	log.Println("Nueva conexión WebSocket intentada")
	botPhone := c.Query("phone")      // Este es el número DEL BOT
	sessionId := c.Query("sessionId") // ID de la sesión (opcional)
	if botPhone == "" {
		log.Println("Bot phone number missing in WebSocket connection")
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	// Usar sessionId como identificador único si está presente
	botKey := botPhone
	if sessionId != "" {
		botKey = fmt.Sprintf("%s:%s", sessionId, botPhone)
	}

	// Verificar si el bot ya está registrado
	if _, err := hub.GetBotConnection(botKey); err == nil {
		log.Printf("Bot %s ya está registrado", botKey)
		c.AbortWithStatus(http.StatusConflict)
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("WebSocket upgrade failed:", err)
		return
	}

	// Registrar la conexión del BOT con la clave única
	log.Printf("Registrando bot: %s (session: %s)", botPhone, sessionId)
	hub.RegisterBot(botKey, conn)

	// Manejar mensajes entrantes
	go func() {
		defer func() {
			hub.UnregisterBot(botKey)
			conn.Close()
			log.Printf("Conexión cerrada para bot: %s (session: %s)", botPhone, sessionId)
		}()

		for {
			// Procesar mensajes, primero convertir de json a struct
			var msg IncomingMessageRequest
			if err := conn.ReadJSON(&msg); err != nil {
				if !websocket.IsCloseError(err, websocket.CloseNormalClosure) {
					log.Printf("Error reading message: %v", err)
				}
				break
			}
			// Procesar mensaje
			if err := processIncomingMessage(msg, hub); err != nil {
				log.Printf("Error processing message: %v", err)
			}
		}
	}()
}

// processIncomingMessage procesa los mensajes entrantes
func processIncomingMessage(msg IncomingMessageRequest, hub *WebSocketHub) error {
	if strings.Contains(msg.Phone, "@g.us") {
		log.Printf("⚠️ Mensaje de grupo ignorado: %s", msg.Phone)
		return nil
	}
	// Asegurar formato consistente del botNumber
	sessionId := msg.SessionID
	if sessionId == "" {
		sessionId = "default"
	}
	botKey := fmt.Sprintf("%s:%s", sessionId, msg.BotNumber)

	log.Printf("Procesando mensaje de %s a bot %s (session: %s): %s (tipo: %s)", msg.Phone, msg.BotNumber, sessionId, msg.Message, msg.MessageType)

	// Verificar si es un mensaje de audio
	if msg.MessageType == "audio" {
		log.Printf("Mensaje de audio recibido de %s - respondiendo automáticamente", msg.Phone)

		// Responder automáticamente sin procesar con Rasa
		responseText := "🤖 Lo siento, por ahora solo puedo procesar mensajes de texto. Por favor, envíame tu mensaje escrito. 📝"

		// Enviar respuesta automática al cliente
		if err := hub.SendToBot(botKey, map[string]interface{}{
			"to":        msg.Phone,
			"message":   responseText,
			"sessionId": sessionId,
		}); err != nil {
			log.Printf("Failed to send audio response to bot: %v", err)
		}

		// Guardar el mensaje de audio y la respuesta en la DB
		cleanPhone := strings.Split(msg.Phone, "@")[0]
		client, err := clientRepo.GetOrCreateClient(cleanPhone, "", "")
		if err != nil {
			return fmt.Errorf("failed to get/create client: %w", err)
		}

		cleanBotNumber := strings.Split(msg.BotNumber, "@")[0]
		bot, err := botRepo.GetOrCreateBot(cleanBotNumber, "Default Bot")
		if err != nil {
			return fmt.Errorf("failed to get/create bot: %w", err)
		}

		// Guardar mensaje de audio del usuario
		clientMsg := models.Message{
			ClientID:  client.ID,
			BotID:     bot.ID,
			Sender:    msg.Phone,
			Text:      "[Audio recibido]",
			Timestamp: time.Now(),
		}
		if err := conversationRepo.SaveMessage(context.TODO(), client.ID, bot.ID, clientMsg); err != nil {
			log.Printf("Failed to save audio message: %v", err)
		}

		// Guardar respuesta automática del bot
		botMsg := models.Message{
			ClientID:  client.ID,
			BotID:     bot.ID,
			Sender:    "bot",
			Text:      responseText,
			Timestamp: time.Now(),
		}
		if err := conversationRepo.SaveMessage(context.TODO(), client.ID, bot.ID, botMsg); err != nil {
			log.Printf("Failed to save bot response: %v", err)
		}

		return nil
	}

	// 1. Procesar cliente (guardar en DB)
	cleanPhone := strings.Split(msg.Phone, "@")[0]
	client, err := clientRepo.GetOrCreateClient(cleanPhone, "", "")
	if err != nil {
		return fmt.Errorf("failed to get/create client: %w", err)
	}

	// 2. Procesar bot (guardar en DB)
	cleanBotNumber := strings.Split(msg.BotNumber, "@")[0]
	bot, err := botRepo.GetOrCreateBot(cleanBotNumber, "Default Bot")
	if err != nil {
		return fmt.Errorf("failed to get/create bot: %w", err)
	}

	// 3. Guardar mensaje del usuario
	clientMsg := models.Message{
		ClientID:  client.ID,
		BotID:     bot.ID,
		Sender:    msg.Phone,
		Text:      msg.Message,
		Timestamp: time.Now(),
	}

	if err := conversationRepo.SaveMessage(context.TODO(), client.ID, bot.ID, clientMsg); err != nil {
		return fmt.Errorf("failed to save client message: %w", err)
	}

	// 4. Procesar con Rasa
	// Usar sender con sessionId para aislamiento de contexto
	senderWithSession := fmt.Sprintf("%s:%s", sessionId, msg.Phone)
	rasaResponses, err := sendToRasaDynamic(senderWithSession, msg.Message, msg.BotNumber, hub)
	if err != nil {
		return fmt.Errorf("rasa processing failed: %w", err)
	}
	log.Printf("Respuestas de Rasa recibidas: %+v", rasaResponses)

	// 5. Procesar respuestas
	for _, response := range rasaResponses {
		if response.Text == "" {
			continue
		}

		// Guardar respuesta del bot
		botMsg := models.Message{
			ClientID:  client.ID,
			BotID:     bot.ID,
			Sender:    "bot",
			Text:      response.Text,
			Timestamp: time.Now(),
		}
		if err := conversationRepo.SaveMessage(context.TODO(), client.ID, bot.ID, botMsg); err != nil {
			log.Printf("Failed to save bot message: %v", err)
		}

		// Enviar respuesta al cliente usando la clave del bot
		log.Printf("Enviando respuesta a bot %s (session: %s) para cliente %s: %s",
			msg.BotNumber, sessionId, msg.Phone, response.Text)

		if err := hub.SendToBot(botKey, map[string]interface{}{
			"to":        msg.Phone, // Cliente destino
			"message":   response.Text,
			"sessionId": sessionId, // Incluir sessionId en la respuesta
		}); err != nil {
			log.Printf("Failed to send message to bot: %v", err)
		}
	}

	return nil
}

// sendToRasaDynamic envía mensajes al servidor Rasa
func sendToRasaDynamic(sender, message, botNumber string, hub *WebSocketHub) ([]RasaResponseItem, error) {
	// Limpiar número de bot
	cleanBotNumber := strings.Split(botNumber, "@")[0]

	// Buscar si hay una instancia específica para este bot
	var instance models.BotInstance
	err := database.GetDB().Where("whatsapp_number = ? AND status = ?", cleanBotNumber, "running").First(&instance).Error

	rasaURL := "http://rasa:5005" // URL por defecto (bot base)

	if err == nil {
		// Si existe una instancia, usar su puerto
		rasaURL = fmt.Sprintf("http://localhost:%d", instance.Port)
		log.Printf("🔀 Enrutando a instancia personalizada: %s (puerto %d)", instance.Name, instance.Port)
	} else {
		log.Printf("🔀 Usando bot base (puerto 5005)")
	}

	return sendToRasa(rasaURL, sender, message)
}

// sendToRasa envía mensajes al servidor Rasa (versión actualizada con URL dinámica)
func sendToRasa(rasaURL, sender, message string) ([]RasaResponseItem, error) {
	payload := map[string]interface{}{
		"sender":  sender,
		"message": message,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	webhookURL := fmt.Sprintf("%s/webhooks/rest/webhook", rasaURL)
	req, err := http.NewRequest("POST", webhookURL, bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	var responses []RasaResponseItem
	if err := json.NewDecoder(resp.Body).Decode(&responses); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return responses, nil
}
