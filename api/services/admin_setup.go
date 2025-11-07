package services

import (
	"log"
	"os"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/brando1998/docubot-api/models"
)

// DefaultAdminCredentials contiene las credenciales por defecto del admin
type DefaultAdminCredentials struct {
	Username string
	Email    string
	Password string
}

// GetDefaultAdminCredentials obtiene las credenciales del admin desde variables de entorno o usa valores por defecto
func GetDefaultAdminCredentials() DefaultAdminCredentials {
	return DefaultAdminCredentials{
		Username: getEnvOrDefault("ADMIN_USERNAME", "admin"),
		Email:    getEnvOrDefault("ADMIN_EMAIL", "admin@docubot.local"),
		Password: getEnvOrDefault("ADMIN_PASSWORD", "DocubotAdmin123!"),
	}
}

// EnsureDefaultAdminUser verifica si existe un usuario administrador y lo crea si no existe
// También asegura que exista una organización por defecto
func EnsureDefaultAdminUser(db *gorm.DB) error {
	log.Println("🔍 Verificando organización y usuario administrador por defecto...")

	// 1. Verificar/Crear organización por defecto
	var defaultOrg models.Organization
	err := db.Where("slug = ?", "default").First(&defaultOrg).Error
	
	if err == gorm.ErrRecordNotFound {
		log.Println("📦 Creando organización por defecto...")
		defaultOrg = models.Organization{
			Name:     "Default Organization",
			Slug:     "default",
			IsActive: true,
		}
		if err := db.Create(&defaultOrg).Error; err != nil {
			return err
		}
		log.Printf("✅ Organización por defecto creada con ID: %d", defaultOrg.ID)
	} else if err != nil {
		return err
	} else {
		log.Printf("✅ Organización por defecto ya existe (ID: %d)", defaultOrg.ID)
	}

	// 2. Verificar si ya existe un usuario con rol admin en esta organización
	var adminExists int64
	err = db.Model(&models.SystemUser{}).
		Where("role = ? AND organization_id = ?", "admin", defaultOrg.ID).
		Count(&adminExists).Error
	if err != nil {
		return err
	}

	// Si ya existe un admin en esta org, no hacer nada
	if adminExists > 0 {
		log.Printf("✅ Usuario administrador ya existe en la organización por defecto (%d admins encontrados)", adminExists)
		return nil
	}

	// 3. Obtener credenciales por defecto
	creds := GetDefaultAdminCredentials()

	// 4. Verificar si ya existe un usuario con el mismo username o email
	var existingUser models.SystemUser
	err = db.Where("username = ? OR email = ?", creds.Username, creds.Email).First(&existingUser).Error
	if err == nil {
		log.Printf("⚠️  Usuario con username '%s' o email '%s' ya existe pero no es admin. Saltando creación automática.",
			creds.Username, creds.Email)
		return nil
	}

	// 5. Hash de la contraseña
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(creds.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	// 6. Crear usuario administrador
	adminUser := models.SystemUser{
		OrganizationID: defaultOrg.ID, // 🆕 Asignar a organización por defecto
		Username:       creds.Username,
		Email:          creds.Email,
		PasswordHash:   string(hashedPassword),
		Role:           "admin",
		IsActive:       true,
	}

	// 7. Guardar en la base de datos
	if err := db.Create(&adminUser).Error; err != nil {
		return err
	}

	log.Printf("🎉 ¡Usuario administrador creado exitosamente!")
	log.Printf("📝 Username: %s", adminUser.Username)
	log.Printf("📧 Email: %s", adminUser.Email)
	log.Printf("👤 Rol: %s", adminUser.Role)
	log.Printf("🏢 Organización: %s (ID: %d)", defaultOrg.Name, defaultOrg.ID)
	log.Printf("🆔 ID: %d", adminUser.ID)

	// Log de credenciales para development (solo si no son variables de entorno personalizadas)
	if os.Getenv("ADMIN_USERNAME") == "" && os.Getenv("ADMIN_PASSWORD") == "" {
		log.Printf("🔑 CREDENCIALES POR DEFECTO:")
		log.Printf("   Username: %s", creds.Username)
		log.Printf("   Password: %s", creds.Password)
		log.Printf("⚠️  CAMBIA ESTAS CREDENCIALES EN PRODUCCIÓN usando variables de entorno!")
	}

	return nil
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}