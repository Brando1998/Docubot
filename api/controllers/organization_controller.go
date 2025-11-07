package controllers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/brando1998/docubot-api/middleware"
	"github.com/brando1998/docubot-api/models"
	"github.com/brando1998/docubot-api/repositories"
)

var organizationRepo repositories.OrganizationRepository

// SetOrganizationRepo establece el repositorio de organizaciones
func SetOrganizationRepo(repo repositories.OrganizationRepository) {
	organizationRepo = repo
}

// CreateOrganization crea una nueva organización (solo admin)
func CreateOrganization(c *gin.Context) {
	var req struct {
		Name string `json:"name" binding:"required"`
		Slug string `json:"slug" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	org := models.Organization{
		Name:     req.Name,
		Slug:     req.Slug,
		IsActive: true,
	}

	if err := organizationRepo.Create(&org); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo crear la organización"})
		return
	}

	c.JSON(http.StatusCreated, org)
}

// GetOrganizations obtiene todas las organizaciones (solo admin)
func GetOrganizations(c *gin.Context) {
	orgs, err := organizationRepo.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudieron obtener las organizaciones"})
		return
	}

	c.JSON(http.StatusOK, orgs)
}

// GetOrganizationByID obtiene una organización por ID
func GetOrganizationByID(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID inválido"})
		return
	}

	org, err := organizationRepo.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organización no encontrada"})
		return
	}

	c.JSON(http.StatusOK, org)
}

// GetMyOrganization obtiene la organización del usuario autenticado
func GetMyOrganization(c *gin.Context) {
	orgID, exists := middleware.GetOrganizationID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No se pudo obtener la organización"})
		return
	}

	org, err := organizationRepo.GetByID(orgID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organización no encontrada"})
		return
	}

	c.JSON(http.StatusOK, org)
}

// UpdateOrganization actualiza una organización (solo admin)
func UpdateOrganization(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID inválido"})
		return
	}

	org, err := organizationRepo.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organización no encontrada"})
		return
	}

	var req struct {
		Name     string `json:"name"`
		Slug     string `json:"slug"`
		IsActive *bool  `json:"is_active"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Name != "" {
		org.Name = req.Name
	}
	if req.Slug != "" {
		org.Slug = req.Slug
	}
	if req.IsActive != nil {
		org.IsActive = *req.IsActive
	}

	if err := organizationRepo.Update(org); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo actualizar la organización"})
		return
	}

	c.JSON(http.StatusOK, org)
}

// DeleteOrganization elimina una organización (solo admin)
func DeleteOrganization(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID inválido"})
		return
	}

	if err := organizationRepo.Delete(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo eliminar la organización"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Organización eliminada exitosamente"})
}