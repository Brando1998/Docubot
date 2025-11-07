package middleware

import (
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/o1egl/paseto"

	database "github.com/brando1998/docubot-api/databases"
	"github.com/brando1998/docubot-api/models"
)

var (
	ErrInvalidToken         = errors.New("token inválido")
	ErrInvalidTokenFormat   = errors.New("formato de token inválido")
	ErrUnsupportedTokenType = errors.New("tipo de token no soportado")
)

// PasetoAuthMiddleware verifica tokens PASETO para usuarios del sistema
func PasetoAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := extractToken(c)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}

		payload, err := verifyPasetoToken(token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}

		db := database.GetDB()
		if db == nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "error de conexión a base de datos"})
			return
		}

		// Verificar si el usuario aún existe y cargar la organización
		var user models.SystemUser
		if err := db.Preload("Organization").First(&user, payload.UserID).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "usuario no encontrado"})
			return
		}

		// Verificar que el usuario esté activo
		if !user.IsActive {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "usuario inactivo"})
			return
		}

		// Verificar que la organización esté activa
		if !user.Organization.IsActive {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "organización inactiva"})
			return
		}

		// Almacenar datos en el contexto
		c.Set("current_user_id", payload.UserID)
		c.Set("current_user_role", payload.Role)
		c.Set("organization_id", user.OrganizationID) // 🆕 Incluir organization_id
		c.Set("current_user", user)
		c.Next()
	}
}

// verifyPasetoToken verifica y decodifica el token usando models.PasetoPayload
func verifyPasetoToken(token string) (*models.PasetoPayload, error) {
	v2 := paseto.NewV2()
	var payload models.PasetoPayload

	secretKey := []byte(os.Getenv("PASETO_SECRET_KEY"))
	if len(secretKey) == 0 {
		secretKey = []byte("default-secret-key-change-in-production-32-chars")
	}

	if err := v2.Decrypt(token, secretKey, &payload, nil); err != nil {
		return nil, ErrInvalidToken
	}

	if time.Now().After(payload.ExpiresAt) {
		return nil, errors.New("token expirado")
	}

	return &payload, nil
}

func extractToken(c *gin.Context) (string, error) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		return "", errors.New("cabecera de autorización no proporcionada")
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return "", errors.New("formato de autorización inválido")
	}

	return parts[1], nil
}