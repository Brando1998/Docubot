package controllers

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/gin-gonic/gin"
	"github.com/o1egl/paseto"

	database "github.com/brando1998/docubot-api/databases"
	"github.com/brando1998/docubot-api/models"
)

const (
	tokenDuration = 24 * time.Hour
)

// ✅ SIMPLIFICAR: Token solo con lo esencial
type PasetoPayload struct {
	UserID    uint      `json:"user_id"`
	Username  string    `json:"username"`
	Role      string    `json:"role"`
	IssuedAt  time.Time `json:"issued_at"`
	ExpiresAt time.Time `json:"expires_at"`
	// ✅ NO incluir email - lo obtendremos del endpoint /auth/me
}

// LoginRequest define la estructura para el request de login
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// LoginResponse define la estructura de respuesta para el login
type LoginResponse struct {
	AccessToken string    `json:"access_token"`
	ExpiresAt   time.Time `json:"expires_at"`
	User        struct {
		ID       uint   `json:"id"`
		Username string `json:"username"`
		Email    string `json:"email"`
		Role     string `json:"role"`
	} `json:"user"`
}

// LoginWithPaseto maneja el inicio de sesión
func LoginWithPaseto(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "datos inválidos"})
		return
	}

	db := database.GetDB()
	if db == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error de conexión a base de datos"})
		return
	}

	var user models.SystemUser
	// Buscar por username o email
	if err := db.Where("username = ? OR email = ?", req.Username, req.Username).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "credenciales inválidas"})
		return
	}

	if !user.IsActive {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "usuario inactivo"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "credenciales inválidas"})
		return
	}

	now := time.Now()
	user.LastLogin = &now
	db.Save(&user)

	// ✅ SIMPLIFICAR: Token sin email
	token, expiresAt, err := generatePasetoToken(user.ID, user.Username, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error generando token"})
		return
	}

	response := LoginResponse{
		AccessToken: token,
		ExpiresAt:   expiresAt,
	}
	response.User.ID = user.ID
	response.User.Username = user.Username
	response.User.Email = user.Email
	response.User.Role = user.Role

	c.JSON(http.StatusOK, response)
}

// generatePasetoToken genera un nuevo token PASETO
func generatePasetoToken(userID uint, username, role string) (string, time.Time, error) {
	fmt.Printf("🔍 DEBUG generatePasetoToken - UserID: %d, Username: %s, Role: %s\n", userID, username, role)

	now := time.Now()
	expiresAt := now.Add(tokenDuration)

	payload := PasetoPayload{
		UserID:    userID,
		Username:  username,
		Role:      role,
		IssuedAt:  now,
		ExpiresAt: expiresAt,
	}

	fmt.Printf("🔍 DEBUG - Payload creado: %+v\n", payload)

	secretKeyFromEnv := os.Getenv("PASETO_SECRET_KEY")
	fmt.Printf("🔍 DEBUG - Variable PASETO_SECRET_KEY completa: '%s'\n", secretKeyFromEnv)
	fmt.Printf("🔍 DEBUG - Longitud exacta: %d caracteres\n", len(secretKeyFromEnv))

	secretKey := []byte(secretKeyFromEnv)

	fmt.Printf("🔍 DEBUG - Longitud después de []byte: %d\n", len(secretKey))

	if len(secretKey) == 0 {
		fmt.Printf("🔍 DEBUG - Variable vacía, usando clave por defecto\n")
		secretKey = []byte("default-secret-key-change-in-production-32-chars")
		fmt.Printf("🔍 DEBUG - Nueva longitud: %d\n", len(secretKey))
	}

	if len(secretKey) != 32 {
		fmt.Printf("❌ DEBUG - Longitud de clave incorrecta: %d, se requieren 32\n", len(secretKey))
		return "", time.Time{}, errors.New("PASETO_SECRET_KEY debe tener exactamente 32 caracteres")
	}

	fmt.Printf("🔍 DEBUG - Intentando encriptar token...\n")
	v2 := paseto.NewV2()
	token, err := v2.Encrypt(secretKey, payload, nil)
	if err != nil {
		fmt.Printf("❌ DEBUG - Error en v2.Encrypt: %v\n", err)
		return "", time.Time{}, err
	}

	fmt.Printf("✅ DEBUG - Token generado exitosamente, longitud: %d\n", len(token))
	return token, expiresAt, nil
}

// RefreshPasetoToken maneja la renovación de tokens
func RefreshPasetoToken(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "token no proporcionado"})
		return
	}

	tokenString := authHeader
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		tokenString = authHeader[7:]
	}

	payload, err := verifyPasetoToken(tokenString)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "token inválido"})
		return
	}

	db := database.GetDB()
	if db == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error de conexión a base de datos"})
		return
	}

	var user models.SystemUser
	if err := db.First(&user, payload.UserID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "usuario no encontrado"})
		return
	}

	// ✅ SIMPLIFICAR: Nuevo token sin email
	newToken, expiresAt, err := generatePasetoToken(user.ID, user.Username, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error generando nuevo token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token": newToken,
		"expires_at":   expiresAt,
	})
}

// ✅ NUEVO: Endpoint para obtener usuario actual del sistema
func GetCurrentSystemUser(c *gin.Context) {
	// Obtener ID del usuario desde el middleware
	userID, exists := c.Get("current_user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Usuario no autenticado"})
		return
	}

	id, ok := userID.(uint)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error de autenticación"})
		return
	}

	db := database.GetDB()
	if db == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error de conexión a base de datos"})
		return
	}

	// ✅ CORREGIR: Buscar en SystemUser, no en Client
	var user models.SystemUser
	if err := db.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Usuario no encontrado"})
		return
	}

	// ✅ RESPUESTA: Solo datos necesarios, sin password
	c.JSON(http.StatusOK, gin.H{
		"id":         user.ID,
		"username":   user.Username,
		"email":      user.Email,
		"role":       user.Role,
		"is_active":  user.IsActive,
		"last_login": user.LastLogin,
	})
}

// verifyPasetoToken verifica y decodifica el token
func verifyPasetoToken(token string) (*PasetoPayload, error) {
	v2 := paseto.NewV2()
	var payload PasetoPayload

	secretKey := []byte(os.Getenv("PASETO_SECRET_KEY"))
	if len(secretKey) == 0 {
		secretKey = []byte("default-secret-key-change-in-production-32-chars")
	}

	if len(secretKey) != 32 {
		return nil, errors.New("PASETO_SECRET_KEY debe tener exactamente 32 caracteres")
	}

	if err := v2.Decrypt(token, secretKey, &payload, nil); err != nil {
		return nil, errors.New("token inválido")
	}

	if time.Now().After(payload.ExpiresAt) {
		return nil, errors.New("token expirado")
	}

	return &payload, nil
}
