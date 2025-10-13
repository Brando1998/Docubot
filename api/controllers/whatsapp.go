// api/controllers/whatsapp.go - Versión corregida y completa
package controllers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"time"

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
		Number   string    `json:"number,omitempty"`
		Name     string    `json:"name,omitempty"`
		Avatar   string    `json:"avatar,omitempty"`
		LastSeen time.Time `json:"last_seen,omitempty"`
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
		Name   string `json:"name,omitempty"`
		Avatar string `json:"avatar,omitempty"`
	} `json:"session_info"`
}

// SendMessageRequest estructura para enviar mensajes
type SendMessageRequest struct {
	To      string `json:"to" binding:"required"`
	Message string `json:"message" binding:"required"`
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
// @Success 200 {object} WhatsAppQRResponse
// @Failure 500 {object} map[string]string
// @Router /api/v1/whatsapp/qr [get]
func GetWhatsAppQR(c *gin.Context) {
	// URL del servicio Baileys
	baileysURL := "http://baileys:3000/qr" // Ajusta según tu configuración

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

	// Retornar respuesta de Baileys tal como la recibimos
	c.JSON(http.StatusOK, baileysResponse)
}

// DisconnectWhatsApp termina la sesión actual
// @Summary Desconectar sesión de WhatsApp
// @Description Termina la sesión activa de WhatsApp
// @Tags whatsapp
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]string
// @Router /api/v1/whatsapp/disconnect [post]
func DisconnectWhatsApp(c *gin.Context) {
	// URL del servicio Baileys para desconectar
	baileysURL := "http://baileys:3000/disconnect"

	// Hacer solicitud POST a Baileys
	resp, err := http.Post(baileysURL, "application/json", nil)
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
// @Success 200 {object} WhatsAppStatusResponse
// @Failure 500 {object} map[string]string
// @Router /api/v1/whatsapp/status [get]
func GetSessionStatus(c *gin.Context) {
	// URL del servicio Baileys para obtener estado
	baileysURL := "http://baileys:3000/status"

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

	c.JSON(http.StatusOK, baileysResponse)
}

// SendWhatsAppMessage envía un mensaje por WhatsApp
// @Summary Enviar mensaje por WhatsApp
// @Description Envía un mensaje de texto a un número específico
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

	// Preparar mensaje para Baileys
	messagePayload := map[string]string{
		"to":      request.To,
		"message": request.Message,
	}

	jsonData, err := json.Marshal(messagePayload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error preparando mensaje",
		})
		return
	}

	// Enviar a Baileys
	baileysURL := "http://baileys:3000/send"
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
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]string
// @Router /api/v1/whatsapp/restart [post]
func RestartWhatsAppSession(c *gin.Context) {
	// URL para reiniciar sesión en Baileys
	baileysURL := "http://baileys:3000/restart"

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
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]string
// @Router /api/v1/whatsapp/clear-session [post]
func ClearWhatsAppSession(c *gin.Context) {
	// URL para limpiar credenciales en Baileys
	baileysURL := "http://baileys:3000/clear-session"

	resp, err := http.Post(baileysURL, "application/json", nil)
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
