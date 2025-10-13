// api/routes/routes.go - Versión actualizada con endpoints WhatsApp
package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	"github.com/brando1998/docubot-api/controllers"
	_ "github.com/brando1998/docubot-api/docs"
	"github.com/brando1998/docubot-api/middleware"
)

type RouterConfig struct {
	WSHub    *controllers.WebSocketHub
	Upgrader *websocket.Upgrader
}

func SetupRoutes(r *gin.Engine, config *RouterConfig) {
	// =============================================
	// Middlewares globales
	// =============================================
	r.Use(
		middleware.LoggerMiddleware(),
		middleware.CORSMiddleware(),
	)

	// =============================================
	// Rutas Públicas (sin autenticación)
	// =============================================
	public := r.Group("/")
	{
		public.GET("/health", controllers.Health)
		public.GET("/docs/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

		// WebSocket para conexión con Baileys
		public.GET("/ws", func(c *gin.Context) {
			controllers.HandleWebSocket(c, config.WSHub, *config.Upgrader)
		})

		// Debug: listar bots conectados
		public.GET("/debug/bots", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"bots":  config.WSHub.ListBots(),
				"total": len(config.WSHub.ListBots()),
			})
		})
	}

	// =============================================
	// Autenticación
	// =============================================
	authGroup := r.Group("/auth")
	{
		authGroup.POST("/login", controllers.LoginWithPaseto)
		authGroup.POST("/refresh", controllers.RefreshPasetoToken)
		authGroup.GET("/me", middleware.PasetoAuthMiddleware(), controllers.GetCurrentSystemUser)
	}

	// =============================================
	// Rutas Protegidas con PASETO
	// =============================================
	api := r.Group("/api/v1")
	api.Use(middleware.PasetoAuthMiddleware())
	{
		// --------------------------
		// Usuarios
		// --------------------------
		userGroup := api.Group("/users")
		{
			userGroup.GET("/me", controllers.GetCurrentUser)
			userGroup.POST("", controllers.CreateClient)
			userGroup.GET("/id/:id", controllers.GetClientByID)
			userGroup.GET("/phone/:phone", controllers.GetClientByPhone)
			userGroup.POST("/get-or-create", controllers.GetOrCreateClient)
		}

		// --------------------------
		// WhatsApp (Dashboard Management)
		// --------------------------
		whatsappGroup := api.Group("/whatsapp")
		{
			// 🆕 Endpoints principales para el dashboard
			whatsappGroup.GET("/qr", controllers.GetWhatsAppQR)               // Obtener QR o estado
			whatsappGroup.POST("/disconnect", controllers.DisconnectWhatsApp) // Finalizar sesión
			whatsappGroup.GET("/status", controllers.GetSessionStatus)        // Estado detallado

			// Endpoints para manejo de mensajes y sesiones
			whatsappGroup.POST("/send", controllers.SendWhatsAppMessage)           // Enviar mensaje
			whatsappGroup.POST("/restart", controllers.RestartWhatsAppSession)     // Reiniciar sesión completa
			whatsappGroup.POST("/clear-session", controllers.ClearWhatsAppSession) // Limpiar credenciales

			// 🆕 Endpoints para gestión de múltiples sesiones
			whatsappGroup.POST("/sessions", controllers.CreateWhatsAppSession) // Crear nueva sesión
			whatsappGroup.GET("/sessions", controllers.ListWhatsAppSessions)   // Listar todas las sesiones

			// 🆕 Endpoints para gestión de chats
			whatsappGroup.GET("/chats", controllers.GetChatList)                      // Listar chats
			whatsappGroup.GET("/chats/:chatId/messages", controllers.GetChatMessages) // Obtener mensajes de un chat
			whatsappGroup.POST("/chats/:chatId/send", controllers.SendChatMessage)    // Enviar mensaje a un chat
		}

		// --------------------------
		// Gestión de Documentos
		// --------------------------
		documentGroup := api.Group("/documents")
		{
			documentGroup.POST("", controllers.SaveDocument) // Guardar documento generado
		}

		// --------------------------
		// Gestión de Chats Avanzada
		// --------------------------
		chatGroup := api.Group("/chats")
		{
			chatGroup.POST("/mode", controllers.UpdateChatMode) // Actualizar modo bot/usuario
			chatGroup.POST("/archive", controllers.ArchiveChat) // Archivar chat
		}

		// --------------------------
		// Clientes con Documentos
		// --------------------------
		clientGroup := api.Group("/clients")
		{
			clientGroup.GET("/:clientId/documents", controllers.GetClientDocuments) // Obtener documentos de cliente
		}

		// --------------------------
		// Exportación de Conversaciones
		// --------------------------
		conversationGroup := api.Group("/conversations")
		{
			conversationGroup.GET("/:clientId/export", controllers.ExportConversation) // Exportar conversación
		}

		// --------------------------
		// Dashboard y Estadísticas
		// --------------------------
		dashboardGroup := api.Group("/dashboard")
		{
			dashboardGroup.GET("/stats", controllers.GetDashboardStats) // Estadísticas del dashboard
		}
	}

	// =============================================
	// Rutas de Administración (futuro)
	// =============================================
	// admin := r.Group("/admin")
	// admin.Use(middleware.PasetoAdminMiddleware())
	// {
	// 	admin.GET("/metrics", controllers.GetMetrics)
	// 	admin.GET("/users", controllers.GetAllUsers)
	// 	admin.DELETE("/users/:id", controllers.DeleteUser)
	// }
}
