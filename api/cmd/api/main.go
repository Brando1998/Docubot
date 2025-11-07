package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"github.com/brando1998/docubot-api/config"
	"github.com/brando1998/docubot-api/controllers"
	database "github.com/brando1998/docubot-api/databases"
	"github.com/brando1998/docubot-api/models"
	"github.com/brando1998/docubot-api/repositories"
	"github.com/brando1998/docubot-api/routes"
	"github.com/brando1998/docubot-api/services"
)

var (
	upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
	}
)

func initDependencies() (*controllers.WebSocketHub, *gin.Engine) {
	// 1. Configuración inicial
	config.LoadEnv()

	// 2. Conexiones a bases de datos
	if err := database.ConnectPostgres(); err != nil {
		log.Fatalf("Failed to connect to PostgreSQL: %v", err)
	}
	if err := database.ConnectMongoDB(); err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}

	// 3. Migraciones
	runMigrations()

	// 4. 🆕 MIGRACIÓN DE DATOS EXISTENTES A MULTI-TENENCIA
	if err := services.MigrateExistingDataToOrganizations(database.GetDB()); err != nil {
		log.Printf("⚠️  Warning: Error en migración de datos: %v", err)
	}

	// 5. 🔥 Crear organización por defecto y usuario administrador
	if err := services.EnsureDefaultAdminUser(database.GetDB()); err != nil {
		log.Fatalf("Failed to ensure default admin user: %v", err)
	}

	// 6. Inicialización de repositorios
	initRepositories()

	// 7. WebSocket Hub
	wsHub := controllers.NewWebSocketHub()

	// 8. Configuración de Gin
	routerConfig := &routes.RouterConfig{
		WSHub:    wsHub,
		Upgrader: &upgrader,
	}
	r := gin.Default()

	routes.SetupRoutes(r, routerConfig)

	return wsHub, r
}

func runMigrations() {
	log.Println("🔄 Ejecutando migraciones de base de datos...")

	err := database.DB.AutoMigrate(
		&models.Organization{},    // 🆕 Primera para las foreign keys
		&models.Client{},
		&models.Bot{},
		&models.WhatsAppSession{},
		&models.SystemUser{},
		&models.BotInstance{},
	)
	if err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	log.Println("✅ Migraciones completadas exitosamente")
}

func initRepositories() {
	conversationRepo := repositories.NewConversationRepository(database.MongoClient)
	clientRepo := repositories.NewClientRepository(database.DB)
	botRepo := repositories.NewBotRepository(database.DB)
	botInstanceRepo := repositories.NewBotInstanceRepository(database.DB)
	organizationRepo := repositories.NewOrganizationRepository(database.DB) // 🆕

	controllers.SetConversationRepo(conversationRepo)
	controllers.SetClientRepo(clientRepo)
	controllers.SetBotRepo(botRepo)
	controllers.SetBotInstanceRepo(botInstanceRepo)
	controllers.SetOrganizationRepo(organizationRepo) // 🆕

	if err := controllers.InitDockerManager(); err != nil {
		log.Fatalf("Failed to initialize Docker manager: %v", err)
	}
}

func getServerPort() string {
	if port := os.Getenv("PORT"); port != "" {
		return port
	}
	return "8080" // Default port
}

func main() {
	log.Println("🤖 Docubot API - Iniciando...")

	_, router := initDependencies()

	port := getServerPort()
	log.Printf("🚀 Server starting on port %s", port)
	log.Printf("📊 Health endpoint: http://localhost:%s/health", port)
	log.Printf("📚 API docs: http://localhost:%s/docs/index.html", port)

	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}