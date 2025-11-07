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
		// 🆕 Organizaciones
		// --------------------------
		orgGroup := api.Group("/organizations")
		{
			orgGroup.GET("/me", controllers.GetMyOrganization) // Mi organización
			// Solo admin puede crear/modificar organizaciones
			// orgGroup.POST("", middleware.RequireAdmin(), controllers.CreateOrganization)
			// orgGroup.GET("", middleware.RequireAdmin(), controllers.GetOrganizations)
			// orgGroup.GET("/:id", middleware.RequireAdmin(), controllers.GetOrganizationByID)
			// orgGroup.PUT("/:id", middleware.RequireAdmin(), controllers.UpdateOrganization)
			// orgGroup.DELETE("/:id", middleware.RequireAdmin(), controllers.DeleteOrganization)
		}

		// --------------------------
		// Usuarios (Clients)
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
			whatsappGroup.GET("/qr", controllers.GetWhatsAppQR)
			whatsappGroup.POST("/disconnect", controllers.DisconnectWhatsApp)
			whatsappGroup.GET("/status", controllers.GetSessionStatus)
			whatsappGroup.POST("/send", controllers.SendWhatsAppMessage)
			whatsappGroup.POST("/restart", controllers.RestartWhatsAppSession)
			whatsappGroup.POST("/clear-session", controllers.ClearWhatsAppSession)
			whatsappGroup.POST("/sessions", controllers.CreateWhatsAppSession)
			whatsappGroup.GET("/sessions", controllers.ListWhatsAppSessions)
			whatsappGroup.GET("/chats", controllers.GetChatList)
			whatsappGroup.GET("/chats/:chatId/messages", controllers.GetChatMessages)
			whatsappGroup.POST("/chats/:chatId/send", controllers.SendChatMessage)
		}

		// --------------------------
		// Gestión de Documentos
		// --------------------------
		documentGroup := api.Group("/documents")
		{
			documentGroup.POST("", controllers.SaveDocument)
		}

		// --------------------------
		// Gestión de Chats Avanzada
		// --------------------------
		chatGroup := api.Group("/chats")
		{
			chatGroup.POST("/mode", controllers.UpdateChatMode)
			chatGroup.POST("/archive", controllers.ArchiveChat)
		}

		// --------------------------
		// Clientes con Documentos
		// --------------------------
		clientGroup := api.Group("/clients")
		{
			clientGroup.GET("/:clientId/documents", controllers.GetClientDocuments)
		}

		// --------------------------
		// Exportación de Conversaciones
		// --------------------------
		conversationGroup := api.Group("/conversations")
		{
			conversationGroup.GET("/:clientId/export", controllers.ExportConversation)
		}

		// --------------------------
		// Dashboard y Estadísticas
		// --------------------------
		dashboardGroup := api.Group("/dashboard")
		{
			dashboardGroup.GET("/stats", controllers.GetDashboardStats)
		}

		// --------------------------
		// Instancias de Bots
		// --------------------------
		instanceGroup := api.Group("/bot-instances")
		{
			instanceGroup.POST("", controllers.CreateBotInstance)
			instanceGroup.GET("", controllers.ListBotInstances)
			instanceGroup.DELETE("/:id", controllers.DeleteBotInstance)
		}
	}
}