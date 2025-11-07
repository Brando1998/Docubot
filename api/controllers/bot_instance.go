package controllers

import (
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/brando1998/docubot-api/models"
	"github.com/brando1998/docubot-api/repositories"
	"github.com/brando1998/docubot-api/services"
)

var (
	botInstanceRepo repositories.BotInstanceRepository
	dockerManager   *services.DockerManager
)

// SetBotInstanceRepo inyecta el repositorio
func SetBotInstanceRepo(repo repositories.BotInstanceRepository) {
	botInstanceRepo = repo
}

// InitDockerManager inicializa el manager de Docker
func InitDockerManager() error {
	dm, err := services.NewDockerManager()
	if err != nil {
		return err
	}
	dockerManager = dm
	return nil
}

// CreateBotInstance crea una nueva instancia de bot
func CreateBotInstance(c *gin.Context) {
	// 🔧 Obtener organization_id y user_id del contexto directamente
	orgIDInterface, exists := c.Get("organization_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organización no encontrada"})
		return
	}
	orgID := orgIDInterface.(uint)

	userID, exists := c.Get("current_user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Usuario no autenticado"})
		return
	}

	var req struct {
		Name           string `json:"name" binding:"required"`
		BasedOnBotID   uint   `json:"based_on_bot_id"`
		WhatsAppNumber string `json:"whatsapp_number" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	port, err := botInstanceRepo.GetNextAvailablePort()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get available port"})
		return
	}

	containerName := fmt.Sprintf("rasa_%s", req.Name)
	containerID, err := dockerManager.CreateRasaContainer(containerName, port)
	if err != nil {
		log.Printf("Error creando contenedor: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create container"})
		return
	}

	// 🆕 Guardar en base de datos con organization_id
	instance := models.BotInstance{
		OrganizationID: orgID,
		Name:           containerName,
		ContainerID:    containerID,
		Port:           port,
		Status:         "running",
		BasedOnBotID:   req.BasedOnBotID,
		WhatsAppNumber: req.WhatsAppNumber,
		CreatedBy:      userID.(uint),
	}

	if err := botInstanceRepo.Create(&instance); err != nil {
		dockerManager.RemoveContainer(containerID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save instance"})
		return
	}

	log.Printf("✅ Instancia de bot creada: %s en puerto %d", containerName, port)
	c.JSON(http.StatusCreated, instance)
}

// ListBotInstances lista todas las instancias de bots
func ListBotInstances(c *gin.Context) {
	// 🔧 Obtener organization_id del contexto directamente
	orgIDInterface, exists := c.Get("organization_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organización no encontrada"})
		return
	}
	orgID := orgIDInterface.(uint)

	instances, err := botInstanceRepo.GetAll(orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get instances"})
		return
	}

	c.JSON(http.StatusOK, instances)
}

// DeleteBotInstance elimina una instancia
func DeleteBotInstance(c *gin.Context) {
	// 🔧 Obtener organization_id del contexto directamente
	orgIDInterface, exists := c.Get("organization_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Organización no encontrada"})
		return
	}
	orgID := orgIDInterface.(uint)

	id := c.Param("id")
	var instanceID uint
	fmt.Sscanf(id, "%d", &instanceID)

	instance, err := botInstanceRepo.GetByID(instanceID, orgID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Instance not found"})
		return
	}

	dockerManager.StopContainer(instance.ContainerID)
	dockerManager.RemoveContainer(instance.ContainerID)
	botInstanceRepo.Delete(instanceID, orgID)

	log.Printf("🗑️ Instancia eliminada: %s", instance.Name)
	c.JSON(http.StatusOK, gin.H{"message": "Instance deleted"})
}