package controllers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/brando1998/docubot-api/models"
)

// CreateClient godoc
// @Summary Crear un nuevo usuario
// @Description Crea un nuevo usuario en el sistema
// @Tags usuarios
// @Accept json
// @Produce json
// @Param user body models.Client true "Datos del usuario"
// @Success 201 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Router /api/v1/users [post]
func CreateClient(c *gin.Context) {
	// 🆕 Obtener organization_id del contexto
	orgID, exists := middleware.GetOrganizationID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organización no encontrada"})
		return
	}

	var user models.Client
	if err := c.ShouldBindJSON(&user); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos", "details": err.Error()})
		return
	}

	user.OrganizationID = orgID

	if err := clientRepo.CreateClient(&user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al crear usuario", "details": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Usuario creado exitosamente",
		"user":    user,
	})
}

// GetClientByID godoc
// @Summary Obtener usuario por ID
// @Description Retorna un usuario específico por su ID
// @Tags usuarios
// @Produce json
// @Param id path int true "ID del usuario"
// @Success 200 {object} models.Client
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /api/v1/users/id/{id} [get]
func GetClientByID(c *gin.Context) {
	// 🆕 Obtener organization_id del contexto
	orgID, exists := middleware.GetOrganizationID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organización no encontrada"})
		return
	}

	// Obtener ID desde parámetros de URL
	idParam := c.Param("id")
	if idParam == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de usuario requerido"})
		return
	}

	// Convertir string a uint
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID inválido"})
		return
	}

	// Buscar usuario
	user, err := clientRepo.GetClientByID(uint(id), orgID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Usuario no encontrado"})
		return
	}

	c.JSON(http.StatusOK, user)
}

// GetClientByPhone godoc
// @Summary Obtener usuario por teléfono
// @Description Busca un usuario por su número de teléfono
// @Tags usuarios
// @Produce json
// @Param phone path string true "Número de teléfono"
// @Success 200 {object} models.Client
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /api/v1/users/phone/{phone} [get]
func GetClientByPhone(c *gin.Context) {
	// 🆕 Obtener organization_id del contexto
	orgID, exists := middleware.GetOrganizationID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organización no encontrada"})
		return
	}

	phone := c.Param("phone")
	if phone == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Número de teléfono requerido"})
		return
	}

	user, err := clientRepo.GetClientByPhone(phone, orgID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Usuario no encontrado"})
		return
	}

	c.JSON(http.StatusOK, user)
}

// GetDashboardStats obtiene estadísticas para el dashboard
// @Summary Obtener estadísticas del dashboard
// @Description Retorna métricas generales del sistema con filtros de fecha
// @Tags dashboard
// @Produce json
// @Param start_date query string false "Fecha de inicio (YYYY-MM-DD)"
// @Param end_date query string false "Fecha de fin (YYYY-MM-DD)"
// @Param period query string false "Período: day, month, year" Enums(day,month,year)
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]string
// @Router /api/v1/dashboard/stats [get]
func GetDashboardStats(c *gin.Context) {
	startDateStr := c.Query("start_date")
	endDateStr := c.Query("end_date")
	period := c.Query("period")

	// Si no se especifica período, usar "month" por defecto
	if period == "" {
		period = "month"
	}

	// Calcular fechas si no se proporcionan
	startDate, endDate, err := calculateDateRange(startDateStr, endDateStr, period)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Fechas inválidas",
			"details": err.Error(),
		})
		return
	}

	// Obtener estadísticas
	stats, err := calculateDashboardStats(c.Request.Context(), startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error calculando estadísticas",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"period": gin.H{
			"start_date": startDate.Format("2006-01-02"),
			"end_date":   endDate.Format("2006-01-02"),
			"period":     period,
		},
		"stats": stats,
	})
}

// Funciones auxiliares para estadísticas

// calculateDateRange calcula el rango de fechas basado en los parámetros
func calculateDateRange(startDateStr, endDateStr, period string) (time.Time, time.Time, error) {
	now := time.Now()

	var startDate, endDate time.Time

	// Si se proporcionan fechas específicas, usarlas
	if startDateStr != "" && endDateStr != "" {
		var err error
		startDate, err = time.Parse("2006-01-02", startDateStr)
		if err != nil {
			return time.Time{}, time.Time{}, err
		}
		endDate, err = time.Parse("2006-01-02", endDateStr)
		if err != nil {
			return time.Time{}, time.Time{}, err
		}
		return startDate, endDate, nil
	}

	// Calcular basado en período
	switch period {
	case "day":
		startDate = now.Truncate(24 * time.Hour)
		endDate = startDate.Add(24 * time.Hour)
	case "month":
		startDate = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		endDate = startDate.AddDate(0, 1, 0)
	case "year":
		startDate = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
		endDate = startDate.AddDate(1, 0, 0)
	default:
		// Por defecto, último mes
		endDate = time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, now.Location())
		startDate = endDate.AddDate(0, -1, 0)
	}

	return startDate, endDate, nil
}

// calculateDashboardStats calcula todas las estadísticas del dashboard
func calculateDashboardStats(ctx context.Context, startDate, endDate time.Time) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// 1. Estadísticas de clientes
	clientStats, err := getClientStats(ctx, startDate, endDate)
	if err != nil {
		return nil, err
	}
	stats["clients"] = clientStats

	// 2. Estadísticas de documentos
	documentStats, err := getDocumentStats(ctx, startDate, endDate)
	if err != nil {
		return nil, err
	}
	stats["documents"] = documentStats

	// 3. Estadísticas de conversaciones
	conversationStats, err := getConversationStats(ctx, startDate, endDate)
	if err != nil {
		return nil, err
	}
	stats["conversations"] = conversationStats

	// 4. Estadísticas de chatbot
	chatbotStats, err := getChatbotStats(ctx, startDate, endDate)
	if err != nil {
		return nil, err
	}
	stats["chatbot"] = chatbotStats

	return stats, nil
}

// getClientStats obtiene estadísticas de clientes
func getClientStats(ctx context.Context, startDate, endDate time.Time) (map[string]interface{}, error) {
	// Total de clientes
	totalClients, err := clientRepo.GetTotalClients(ctx)
	if err != nil {
		return nil, err
	}

	// Clientes nuevos en el período
	newClients, err := clientRepo.GetClientsCreatedBetween(ctx, startDate, endDate)
	if err != nil {
		return nil, err
	}

	// Clientes activos (que han tenido conversaciones)
	activeClients, err := getActiveClientsCount(ctx, startDate, endDate)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"total":       totalClients,
		"new":         len(newClients),
		"active":      activeClients,
		"new_clients": newClients,
	}, nil
}

// getDocumentStats obtiene estadísticas de documentos
func getDocumentStats(ctx context.Context, startDate, endDate time.Time) (map[string]interface{}, error) {
	// Total de documentos
	totalDocuments, err := conversationRepo.GetTotalDocuments(ctx)
	if err != nil {
		return nil, err
	}

	// Documentos generados en el período
	documentsInPeriod, err := conversationRepo.GetDocumentsCreatedBetween(ctx, startDate, endDate)
	if err != nil {
		return nil, err
	}

	// Documentos por tipo
	documentsByType, err := conversationRepo.GetDocumentsByType(ctx, startDate, endDate)
	if err != nil {
		return nil, err
	}

	// Documentos completados vs fallidos
	completedDocs := 0
	failedDocs := 0
	for _, doc := range documentsInPeriod {
		if doc.Status == "completed" {
			completedDocs++
		} else if doc.Status == "failed" {
			failedDocs++
		}
	}

	return map[string]interface{}{
		"total":            totalDocuments,
		"generated":        len(documentsInPeriod),
		"completed":        completedDocs,
		"failed":           failedDocs,
		"by_type":          documentsByType,
		"recent_documents": documentsInPeriod,
	}, nil
}

// getConversationStats obtiene estadísticas de conversaciones
func getConversationStats(ctx context.Context, startDate, endDate time.Time) (map[string]interface{}, error) {
	// Total de mensajes
	totalMessages, err := conversationRepo.GetTotalMessages(ctx)
	if err != nil {
		return nil, err
	}

	// Mensajes en el período
	messagesInPeriod, err := conversationRepo.GetMessagesBetween(ctx, startDate, endDate)
	if err != nil {
		return nil, err
	}

	// Conversaciones activas
	activeConversations, err := conversationRepo.GetActiveConversations(ctx, startDate, endDate)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"total_messages":                totalMessages,
		"messages_in_period":            len(messagesInPeriod),
		"active_conversations":          len(activeConversations),
		"avg_messages_per_conversation": calculateAverageMessages(activeConversations),
	}, nil
}

// getChatbotStats obtiene estadísticas del chatbot
func getChatbotStats(ctx context.Context, startDate, endDate time.Time) (map[string]interface{}, error) {
	// Chats en modo bot vs manual
	botModeChats, err := conversationRepo.GetChatsInBotMode(ctx)
	if err != nil {
		return nil, err
	}

	manualModeChats, err := conversationRepo.GetChatsInManualMode(ctx)
	if err != nil {
		return nil, err
	}

	// Chats archivados
	archivedChats, err := conversationRepo.GetArchivedChatsCount(ctx, startDate, endDate)
	if err != nil {
		return nil, err
	}

	// Tasa de éxito de formularios (documentos completados / intentos)
	formSuccessRate, err := calculateFormSuccessRate(ctx, startDate, endDate)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"bot_mode_chats":    botModeChats,
		"manual_mode_chats": manualModeChats,
		"archived_chats":    archivedChats,
		"form_success_rate": formSuccessRate,
	}, nil
}

// Funciones auxiliares
func getActiveClientsCount(ctx context.Context, startDate, endDate time.Time) (int, error) {
	// Obtener clientes únicos que han tenido mensajes en el período
	// Implementación simplificada
	return 0, nil // TODO: Implementar
}

func calculateAverageMessages(conversations []interface{}) float64 {
	if len(conversations) == 0 {
		return 0
	}
	// Implementación simplificada
	return 0 // TODO: Implementar cálculo real
}

func calculateFormSuccessRate(ctx context.Context, startDate, endDate time.Time) (float64, error) {
	// Calcular tasa de éxito basada en documentos completados vs totales
	// Implementación simplificada
	return 0.85, nil // TODO: Implementar cálculo real
}

// GetOrCreateClient godoc
// @Summary Obtener o crear un usuario por teléfono
// @Description Busca un usuario por teléfono. Si no existe, lo crea.
// @Tags usuarios
// @Accept json
// @Produce json
// @Param data body map[string]string true "Datos del usuario"
// @Success 200 {object} models.Client
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/users/get-or-create [post]
func GetOrCreateClient(c *gin.Context) {
	// 🆕 Obtener organization_id del contexto
	orgID, exists := middleware.GetOrganizationID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organización no encontrada"})
		return
	}

	var input struct {
		Phone string `json:"phone" binding:"required"`
		Name  string `json:"name"`
		Email string `json:"email"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos", "details": err.Error()})
		return
	}

	if input.Phone == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Número de teléfono requerido"})
		return
	}

	user, err := clientRepo.GetOrCreateClient(input.Phone, input.Name, input.Email, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al procesar usuario", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Usuario procesado exitosamente",
		"user":    user,
	})
}

// GetCurrentUser obtiene el usuario autenticado desde el token
// @Summary Obtener usuario actual
// @Description Retorna el perfil del usuario autenticado
// @Tags usuarios
// @Produce json
// @Success 200 {object} models.Client
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /api/v1/users/me [get]
func GetCurrentUser(c *gin.Context) {
	// Obtener ID del usuario desde el middleware de autenticación
	userID, exists := c.Get("current_user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Usuario no autenticado"})
		return
	}

	// 🆕 Obtener organization_id del contexto
	orgID, exists := middleware.GetOrganizationID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organización no encontrada"})
		return
	}

	// Convertir interface{} a uint
	id, ok := userID.(uint)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error de autenticación"})
		return
	}

	user, err := clientRepo.GetClientByID(id, orgID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Usuario no encontrado"})
		return
	}

	c.JSON(http.StatusOK, user)
}
