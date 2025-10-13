// api/controllers/whatsapp.go - Versión corregida y completa
package controllers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/brando1998/docubot-api/models"
	"github.com/gin-gonic/gin"
)

// WhatsAppQRResponse estructura para la respuesta del QR
type WhatsAppQRResponse struct {
	Status      string `json:"status"`
	Message     string `json:"message"`
	QRCode      string `json:"qr_code,omitempty"`
	QRImage     string `json:"qr_image,omitempty"`
	Connected   bool   `json:"connected"`
	SessionInfo struct {
		SessionID string    `json:"session_id,omitempty"`
		Number    string    `json:"number,omitempty"`
		Name      string    `json:"name,omitempty"`
		Avatar    string    `json:"avatar,omitempty"`
		LastSeen  time.Time `json:"last_seen,omitempty"`
	} `json:"session_info,omitempty"`
}

// WhatsAppStatusResponse estructura para el estado detallado
type WhatsAppStatusResponse struct {
	Status      string    `json:"status"`
	Message     string    `json:"message,omitempty"`
	Connected   bool      `json:"connected"`
	BotNumber   string    `json:"bot_number,omitempty"`
	LastSeen    time.Time `json:"last_seen,omitempty"`
	SessionInfo struct {
		SessionID string `json:"session_id,omitempty"`
		Name      string `json:"name,omitempty"`
		Avatar    string `json:"avatar,omitempty"`
	} `json:"session_info"`
}

// SendMessageRequest estructura para enviar mensajes
type SendMessageRequest struct {
	SessionID string `json:"session_id,omitempty"` // Opcional, usar sesión por defecto si no se especifica
	To        string `json:"to" binding:"required"`
	Message   string `json:"message" binding:"required"`
}

// BaileysRequest estructura para comunicación con Baileys
type BaileysRequest struct {
	Action string `json:"action"`
}

// GetWhatsAppQR obtiene el código QR o estado de sesión
// @Summary Obtener QR de WhatsApp o estado de sesión
// @Description Retorna el código QR para conectar WhatsApp o información de sesión activa
// @Tags whatsapp
// @Produce json
// @Param sessionId query string false "ID de la sesión (opcional, usa 'default' si no se especifica)"
// @Success 200 {object} WhatsAppQRResponse
// @Failure 500 {object} map[string]string
// @Router /api/v1/whatsapp/qr [get]
func GetWhatsAppQR(c *gin.Context) {
	sessionId := c.DefaultQuery("sessionId", "default")

	// URL del servicio Baileys con soporte para sesiones
	baileysURL := fmt.Sprintf("http://baileys:3000/sessions/%s/qr", sessionId)

	// Hacer solicitud a Baileys para obtener QR o estado
	resp, err := http.Get(baileysURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error conectando con servicio de WhatsApp",
			"details": err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	// Si la sesión no existe (404), intentar crearla automáticamente
	if resp.StatusCode == http.StatusNotFound {
		// Intentar crear la sesión
		createURL := fmt.Sprintf("http://baileys:3000/sessions/%s", sessionId)
		createResp, createErr := http.Post(createURL, "application/json", nil)
		if createErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Error creando sesión de WhatsApp",
				"details": createErr.Error(),
			})
			return
		}
		createResp.Body.Close()

		// Reintentar obtener el QR después de crear la sesión
		resp, err = http.Get(baileysURL)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Error conectando con servicio de WhatsApp después de crear sesión",
				"details": err.Error(),
			})
			return
		}
		defer resp.Body.Close()
	}

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error en el servicio de WhatsApp",
		})
		return
	}

	// Decodificar respuesta de Baileys
	var baileysResponse WhatsAppQRResponse
	if err := json.NewDecoder(resp.Body).Decode(&baileysResponse); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error procesando respuesta de WhatsApp",
			"details": err.Error(),
		})
		return
	}

	// Agregar session_id a la respuesta si no está presente
	if baileysResponse.SessionInfo.SessionID == "" {
		baileysResponse.SessionInfo.SessionID = sessionId
	}

	// Retornar respuesta de Baileys tal como la recibimos
	c.JSON(http.StatusOK, baileysResponse)
}

// DisconnectWhatsApp termina la sesión actual
// @Summary Desconectar sesión de WhatsApp
// @Description Termina la sesión activa de WhatsApp
// @Tags whatsapp
// @Produce json
// @Param sessionId query string false "ID de la sesión (opcional, usa 'default' si no se especifica)"
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]string
// @Router /api/v1/whatsapp/disconnect [post]
func DisconnectWhatsApp(c *gin.Context) {
	sessionId := c.DefaultQuery("sessionId", "default")

	// URL del servicio Baileys para desconectar
	baileysURL := fmt.Sprintf("http://baileys:3000/sessions/%s/disconnect", sessionId)

	// Crear payload con sessionId
	payload := map[string]string{"sessionId": sessionId}
	jsonData, _ := json.Marshal(payload)

	// Hacer solicitud POST a Baileys
	resp, err := http.Post(baileysURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error conectando con servicio de WhatsApp",
			"details": err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error desconectando WhatsApp",
		})
		return
	}

	// Decodificar respuesta de Baileys
	var baileysResponse map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&baileysResponse); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error procesando respuesta",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, baileysResponse)
}

// GetSessionStatus obtiene el estado detallado de la sesión
// @Summary Obtener estado detallado de sesión
// @Description Retorna información detallada del estado de la sesión de WhatsApp
// @Tags whatsapp
// @Produce json
// @Param sessionId query string false "ID de la sesión (opcional, usa 'default' si no se especifica)"
// @Success 200 {object} WhatsAppStatusResponse
// @Failure 500 {object} map[string]string
// @Router /api/v1/whatsapp/status [get]
func GetSessionStatus(c *gin.Context) {
	sessionId := c.DefaultQuery("sessionId", "default")

	// URL del servicio Baileys para obtener estado
	baileysURL := fmt.Sprintf("http://baileys:3000/sessions/%s/status", sessionId)

	resp, err := http.Get(baileysURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error conectando con servicio de WhatsApp",
			"details": err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error obteniendo estado de WhatsApp",
		})
		return
	}

	var baileysResponse WhatsAppStatusResponse
	if err := json.NewDecoder(resp.Body).Decode(&baileysResponse); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error procesando respuesta",
			"details": err.Error(),
		})
		return
	}

	// Agregar session_id si no está presente
	if baileysResponse.SessionInfo.SessionID == "" {
		baileysResponse.SessionInfo.SessionID = sessionId
	}

	c.JSON(http.StatusOK, baileysResponse)
}

// GetChatList obtiene la lista de chats de una sesión
// @Summary Obtener lista de chats
// @Description Retorna la lista de chats disponibles en WhatsApp
// @Tags whatsapp
// @Produce json
// @Param sessionId query string false "ID de la sesión (opcional, usa 'default' si no se especifica)"
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]string
// @Router /api/v1/whatsapp/chats [get]
func GetChatList(c *gin.Context) {
	sessionId := c.DefaultQuery("sessionId", "default")

	// URL del servicio Baileys para obtener chats
	baileysURL := fmt.Sprintf("http://baileys:3000/sessions/%s/chats", sessionId)

	resp, err := http.Get(baileysURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error conectando con servicio de WhatsApp",
			"details": err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error obteniendo lista de chats",
		})
		return
	}

	var baileysResponse map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&baileysResponse); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error procesando respuesta de chats",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, baileysResponse)
}

// GetChatMessages obtiene los mensajes de un chat específico
// @Summary Obtener mensajes de un chat
// @Description Retorna los mensajes de un chat específico
// @Tags whatsapp
// @Produce json
// @Param sessionId query string false "ID de la sesión (opcional, usa 'default' si no se especifica)"
// @Param chatId path string true "ID del chat"
// @Param limit query int false "Límite de mensajes (opcional, por defecto 50)"
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]string
// @Router /api/v1/whatsapp/chats/{chatId}/messages [get]
func GetChatMessages(c *gin.Context) {
	sessionId := c.DefaultQuery("sessionId", "default")
	chatId := c.Param("chatId")
	limit := c.DefaultQuery("limit", "50")

	// URL del servicio Baileys para obtener mensajes
	baileysURL := fmt.Sprintf("http://baileys:3000/sessions/%s/chats/%s/messages?limit=%s", sessionId, chatId, limit)

	resp, err := http.Get(baileysURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error conectando con servicio de WhatsApp",
			"details": err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error obteniendo mensajes del chat",
		})
		return
	}

	var baileysResponse map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&baileysResponse); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error procesando respuesta de mensajes",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, baileysResponse)
}

// SaveDocument guarda un documento generado
// @Summary Guardar documento generado
// @Description Guarda información de un documento generado con sus metadatos y entidades
// @Tags documents
// @Accept json
// @Produce json
// @Param document body map[string]interface{} true "Datos del documento"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/documents [post]
func SaveDocument(c *gin.Context) {
	var requestData map[string]interface{}
	if err := c.ShouldBindJSON(&requestData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Datos inválidos",
			"details": err.Error(),
		})
		return
	}

	// Extraer datos requeridos
	clientIDFloat, ok := requestData["client_id"].(float64)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "client_id es requerido y debe ser numérico",
		})
		return
	}
	clientID := uint(clientIDFloat)

	docType, ok := requestData["type"].(string)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "type es requerido",
		})
		return
	}

	fileName, ok := requestData["file_name"].(string)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "file_name es requerido",
		})
		return
	}

	// Crear documento
	document := models.Document{
		ClientID: clientID,
		FileName: fileName,
		Type:     docType,
		Status:   "completed",
	}

	// Agregar campos opcionales
	if url, ok := requestData["url"].(string); ok {
		document.URL = url
	}

	if metadata, ok := requestData["metadata"].(map[string]interface{}); ok {
		document.Metadata = metadata
	}

	if entities, ok := requestData["entities"].(map[string]interface{}); ok {
		document.Entities = entities
	}

	if sessionID, ok := requestData["session_id"].(string); ok {
		document.SessionID = sessionID
	}

	if botIDFloat, ok := requestData["bot_id"].(float64); ok {
		document.BotID = uint(botIDFloat)
	}

	// Guardar en base de datos
	if err := conversationRepo.SaveDocument(c.Request.Context(), document); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error guardando documento",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"message":  "Documento guardado correctamente",
		"document": document,
	})
}

// GetClientDocuments obtiene documentos de un cliente
// @Summary Obtener documentos de un cliente
// @Description Retorna todos los documentos generados para un cliente específico
// @Tags documents
// @Produce json
// @Param clientId path int true "ID del cliente"
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]string
// @Router /api/v1/clients/{clientId}/documents [get]
func GetClientDocuments(c *gin.Context) {
	clientIDStr := c.Param("clientId")
	clientID := parseUint(clientIDStr)
	if clientID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "ID de cliente inválido",
		})
		return
	}

	documents, err := conversationRepo.GetDocumentsByClientID(c.Request.Context(), clientID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error obteniendo documentos",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"documents": documents,
		"total":     len(documents),
	})
}

// UpdateChatMode actualiza el modo de un chat
// @Summary Actualizar modo de chat
// @Description Cambia entre modo bot y modo usuario para un chat específico
// @Tags chats
// @Accept json
// @Produce json
// @Param modeData body map[string]interface{} true "Datos del modo del chat"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/chats/mode [post]
func UpdateChatMode(c *gin.Context) {
	var requestData map[string]interface{}
	if err := c.ShouldBindJSON(&requestData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Datos inválidos",
			"details": err.Error(),
		})
		return
	}

	// Extraer datos requeridos
	clientIDFloat, ok := requestData["client_id"].(float64)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "client_id es requerido y debe ser numérico",
		})
		return
	}
	clientID := uint(clientIDFloat)

	sessionID, ok := requestData["session_id"].(string)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "session_id es requerido",
		})
		return
	}

	chatID, ok := requestData["chat_id"].(string)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "chat_id es requerido",
		})
		return
	}

	botMode, ok := requestData["bot_mode"].(bool)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "bot_mode es requerido y debe ser booleano",
		})
		return
	}

	// Crear o actualizar modo de chat
	chatMode := models.ChatMode{
		ClientID:  clientID,
		SessionID: sessionID,
		ChatID:    chatID,
		BotMode:   botMode,
	}

	if botIDFloat, ok := requestData["bot_id"].(float64); ok {
		chatMode.BotID = uint(botIDFloat)
	}

	// Guardar en base de datos
	if err := conversationRepo.SaveChatMode(c.Request.Context(), chatMode); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error guardando modo de chat",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"message":   "Modo de chat actualizado correctamente",
		"chat_mode": chatMode,
	})
}

// ArchiveChat archiva un chat
// @Summary Archivar chat
// @Description Marca un chat como archivado
// @Tags chats
// @Accept json
// @Produce json
// @Param archiveData body map[string]interface{} true "Datos del chat a archivar"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/chats/archive [post]
func ArchiveChat(c *gin.Context) {
	var requestData map[string]interface{}
	if err := c.ShouldBindJSON(&requestData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Datos inválidos",
			"details": err.Error(),
		})
		return
	}

	// Extraer datos requeridos
	clientIDFloat, ok := requestData["client_id"].(float64)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "client_id es requerido y debe ser numérico",
		})
		return
	}
	clientID := uint(clientIDFloat)

	chatID, ok := requestData["chat_id"].(string)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "chat_id es requerido",
		})
		return
	}

	chatName, ok := requestData["chat_name"].(string)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "chat_name es requerido",
		})
		return
	}

	// Crear registro de archivo
	archive := models.ChatArchive{
		ClientID: clientID,
		ChatID:   chatID,
		ChatName: chatName,
		IsGroup:  false, // Por defecto, cambiar si es necesario
	}

	if sessionID, ok := requestData["session_id"].(string); ok {
		archive.SessionID = sessionID
	}

	if botIDFloat, ok := requestData["bot_id"].(float64); ok {
		archive.BotID = uint(botIDFloat)
	}

	if isGroup, ok := requestData["is_group"].(bool); ok {
		archive.IsGroup = isGroup
	}

	// Guardar en base de datos
	if err := conversationRepo.ArchiveChat(c.Request.Context(), archive); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error archivando chat",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Chat archivado correctamente",
		"archive": archive,
	})
}

// ExportConversation exporta una conversación
// @Summary Exportar conversación
// @Description Exporta todos los mensajes de una conversación específica
// @Tags conversations
// @Produce json
// @Param clientId path int true "ID del cliente"
// @Param sessionId query string true "ID de la sesión"
// @Param chatId query string true "ID del chat"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/conversations/{clientId}/export [get]
func ExportConversation(c *gin.Context) {
	clientIDStr := c.Param("clientId")
	clientID := parseUint(clientIDStr)
	if clientID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "ID de cliente inválido",
		})
		return
	}

	sessionID := c.Query("sessionId")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "sessionId es requerido",
		})
		return
	}

	chatID := c.Query("chatId")
	if chatID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "chatId es requerido",
		})
		return
	}

	messages, err := conversationRepo.ExportConversation(c.Request.Context(), clientID, sessionID, chatID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error exportando conversación",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"messages":   messages,
		"total":      len(messages),
		"client_id":  clientID,
		"session_id": sessionID,
		"chat_id":    chatID,
	})
}

// Función auxiliar para convertir string a uint
func parseUint(s string) uint {
	// Implementación simple, en producción usar strconv.ParseUint
	var result uint
	for _, char := range s {
		if char >= '0' && char <= '9' {
			result = result*10 + uint(char-'0')
		} else {
			return 0
		}
	}
	return result
}

// SendChatMessage envía un mensaje a un chat específico
// @Summary Enviar mensaje a un chat
// @Description Envía un mensaje a un chat específico desde una sesión
// @Tags whatsapp
// @Accept json
// @Produce json
// @Param chatId path string true "ID del chat"
// @Param message body SendMessageRequest true "Datos del mensaje"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/whatsapp/chats/{chatId}/send [post]
func SendChatMessage(c *gin.Context) {
	chatId := c.Param("chatId")
	var request SendMessageRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Datos inválidos",
			"details": err.Error(),
		})
		return
	}

	// Usar sesión por defecto si no se especifica
	sessionId := request.SessionID
	if sessionId == "" {
		sessionId = "default"
	}

	// Preparar mensaje para Baileys
	messagePayload := map[string]string{
		"number":  chatId,
		"message": request.Message,
	}

	jsonData, err := json.Marshal(messagePayload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error preparando mensaje",
		})
		return
	}

	// Enviar a Baileys con sesión específica
	baileysURL := fmt.Sprintf("http://baileys:3000/sessions/%s/send", sessionId)
	resp, err := http.Post(baileysURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error enviando mensaje",
			"details": err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error en el servicio de WhatsApp",
		})
		return
	}

	var baileysResponse map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&baileysResponse); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error procesando respuesta",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, baileysResponse)
}

// SendWhatsAppMessage envía un mensaje por WhatsApp
// @Summary Enviar mensaje por WhatsApp
// @Description Envía un mensaje de texto a un número específico desde una sesión específica
// @Tags whatsapp
// @Accept json
// @Produce json
// @Param message body SendMessageRequest true "Datos del mensaje"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/whatsapp/send [post]
func SendWhatsAppMessage(c *gin.Context) {
	var request SendMessageRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Datos inválidos",
			"details": err.Error(),
		})
		return
	}

	// Usar sesión por defecto si no se especifica
	sessionId := request.SessionID
	if sessionId == "" {
		sessionId = "default"
	}

	// Preparar mensaje para Baileys
	messagePayload := map[string]string{
		"number":  request.To,
		"message": request.Message,
	}

	jsonData, err := json.Marshal(messagePayload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error preparando mensaje",
		})
		return
	}

	// Enviar a Baileys con sesión específica
	baileysURL := fmt.Sprintf("http://baileys:3000/sessions/%s/send", sessionId)
	resp, err := http.Post(baileysURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error enviando mensaje",
			"details": err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error en el servicio de WhatsApp",
		})
		return
	}

	var baileysResponse map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&baileysResponse); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error procesando respuesta",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, baileysResponse)
}

// RestartWhatsAppSession reinicia la sesión completa de WhatsApp
// @Summary Reiniciar sesión de WhatsApp
// @Description Reinicia completamente la sesión de WhatsApp (equivale a reiniciar Baileys)
// @Tags whatsapp
// @Produce json
// @Param sessionId query string false "ID de la sesión (opcional, usa 'default' si no se especifica)"
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]string
// @Router /api/v1/whatsapp/restart [post]
func RestartWhatsAppSession(c *gin.Context) {
	sessionId := c.DefaultQuery("sessionId", "default")

	// URL para reiniciar sesión en Baileys
	baileysURL := fmt.Sprintf("http://baileys:3000/sessions/%s/restart", sessionId)

	resp, err := http.Post(baileysURL, "application/json", nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error reiniciando sesión de WhatsApp",
			"details": err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error en el servicio de WhatsApp al reiniciar",
		})
		return
	}

	// Decodificar respuesta de Baileys
	var baileysResponse map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&baileysResponse); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error procesando respuesta de reinicio",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, baileysResponse)
}

// ClearWhatsAppSession limpia las credenciales de WhatsApp
// @Summary Limpiar credenciales de WhatsApp
// @Description Limpia completamente las credenciales almacenadas de WhatsApp
// @Tags whatsapp
// @Produce json
// @Param sessionId query string false "ID de la sesión (opcional, usa 'default' si no se especifica)"
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]string
// @Router /api/v1/whatsapp/clear-session [post]
func ClearWhatsAppSession(c *gin.Context) {
	sessionId := c.DefaultQuery("sessionId", "default")

	// URL para limpiar credenciales en Baileys
	baileysURL := fmt.Sprintf("http://baileys:3000/sessions/%s", sessionId)

	// Crear request DELETE
	req, err := http.NewRequest("DELETE", baileysURL, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error creando solicitud",
			"details": err.Error(),
		})
		return
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error limpiando credenciales de WhatsApp",
			"details": err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error en el servicio de WhatsApp al limpiar credenciales",
		})
		return
	}

	// Decodificar respuesta de Baileys
	var baileysResponse map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&baileysResponse); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error procesando respuesta de limpieza",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, baileysResponse)
}

// CreateWhatsAppSession crea una nueva sesión de WhatsApp
// @Summary Crear nueva sesión de WhatsApp
// @Description Crea una nueva sesión de WhatsApp con el ID especificado
// @Tags whatsapp
// @Accept json
// @Produce json
// @Param sessionId body map[string]string true "ID de la sesión a crear"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/whatsapp/sessions [post]
func CreateWhatsAppSession(c *gin.Context) {
	var request map[string]string
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Datos inválidos",
			"details": err.Error(),
		})
		return
	}

	sessionId, exists := request["sessionId"]
	if !exists || sessionId == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "sessionId es requerido",
		})
		return
	}

	// URL para crear sesión en Baileys
	baileysURL := fmt.Sprintf("http://baileys:3000/sessions/%s", sessionId)

	resp, err := http.Post(baileysURL, "application/json", nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error creando sesión de WhatsApp",
			"details": err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error en el servicio de WhatsApp al crear sesión",
		})
		return
	}

	var baileysResponse map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&baileysResponse); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error procesando respuesta",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, baileysResponse)
}

// ListWhatsAppSessions lista todas las sesiones activas
// @Summary Listar sesiones de WhatsApp
// @Description Retorna una lista de todas las sesiones activas de WhatsApp
// @Tags whatsapp
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]string
// @Router /api/v1/whatsapp/sessions [get]
func ListWhatsAppSessions(c *gin.Context) {
	// URL para listar sesiones en Baileys
	baileysURL := "http://baileys:3000/sessions"

	resp, err := http.Get(baileysURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error obteniendo lista de sesiones",
			"details": err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error en el servicio de WhatsApp",
		})
		return
	}

	var baileysResponse map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&baileysResponse); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error procesando respuesta",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, baileysResponse)
}
