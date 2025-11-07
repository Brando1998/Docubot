package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// OrganizationMiddleware verifica que el usuario autenticado tenga acceso a la organización
// Este middleware debe usarse DESPUÉS de PasetoAuthMiddleware
func OrganizationMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Obtener el OrganizationID del usuario autenticado (ya está en el context del PasetoAuthMiddleware)
		orgID, exists := c.Get("organization_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Organización no encontrada en el token"})
			c.Abort()
			return
		}

		// Validar que el orgID sea válido
		if orgID.(uint) == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Usuario no tiene organización asignada"})
			c.Abort()
			return
		}

		// El orgID ya está en el context, continuar
		c.Next()
	}
}

// GetOrganizationID extrae el OrganizationID del contexto
// Helper function para usar en los controladores
func GetOrganizationID(c *gin.Context) (uint, bool) {
	orgID, exists := c.Get("organization_id")
	if !exists {
		return 0, false
	}
	return orgID.(uint), true
}