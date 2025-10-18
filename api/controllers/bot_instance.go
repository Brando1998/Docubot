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
// @Summary Crear instancia de bot
// @Description Crea y levanta un nuevo contenedor Rasa
// @Tags bot-instances
// @Accept json
// @Produce json
// @Param instance body map[string]interface{} true "Datos de la instancia"
// @Success 201 {object} models.BotInstance
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/bot-instances [post]
func CreateBotInstance(c *gin.Context) {
	var req struct {
		Name           string `json:"name" binding:"required"`
		BasedOnBotID   uint   `json:"based_on_bot_id"`
		WhatsAppNumber string `json:"whatsapp_number" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Obtener puerto disponible
	port, err := botInstanceRepo.GetNextAvailablePort()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get available port"})
		return
	}

	// Crear contenedor
	containerName := fmt.Sprintf("rasa_%s", req.Name)
	containerID, err := dockerManager.CreateRasaContainer(containerName, port)
	if err != nil {
		log.Printf("Error creando contenedor: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create container"})
		return
	}

	// Guardar en base de datos
	instance := models.BotInstance{
		Name:           containerName,
		ContainerID:    containerID,
		Port:           port,
		Status:         "running",
		BasedOnBotID:   req.BasedOnBotID,
		WhatsAppNumber: req.WhatsAppNumber,
	}

	if err := botInstanceRepo.Create(&instance); err != nil {
		dockerManager.RemoveContainer(containerID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save instance"})
		return
	}

	log.Printf("✅ Instancia de bot creada: %s en puerto %d", containerName, port)
	c.JSON(http.StatusCreated, instance)
}

// ListBotInstances lista todas las instancias
// @Summary Listar instancias de bots
// @Description Retorna todas las instancias de bots creadas
// @Tags bot-instances
// @Produce json
// @Success 200 {array} models.BotInstance
// @Router /api/v1/bot-instances [get]
func ListBotInstances(c *gin.Context) {
	instances, err := botInstanceRepo.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get instances"})
		return
	}

	c.JSON(http.StatusOK, instances)
}

// DeleteBotInstance elimina una instancia
// @Summary Eliminar instancia de bot
// @Description Detiene y elimina un contenedor de bot
// @Tags bot-instances
// @Param id path int true "ID de la instancia"
// @Success 200 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /api/v1/bot-instances/{id} [delete]
func DeleteBotInstance(c *gin.Context) {
	id := c.Param("id")

	var instanceID uint
	fmt.Sscanf(id, "%d", &instanceID)

	instance, err := botInstanceRepo.GetByID(instanceID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Instance not found"})
		return
	}

	dockerManager.StopContainer(instance.ContainerID)
	dockerManager.RemoveContainer(instance.ContainerID)
	botInstanceRepo.Delete(instanceID)

	log.Printf("🗑️ Instancia eliminada: %s", instance.Name)
	c.JSON(http.StatusOK, gin.H{"message": "Instance deleted"})
}
