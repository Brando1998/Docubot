package services

import (
	"log"

	"gorm.io/gorm"

	"github.com/brando1998/docubot-api/models"
)

// MigrateExistingDataToOrganizations migra los datos existentes a la arquitectura multi-tenencia
// Este script debe ejecutarse UNA VEZ después de agregar el campo organization_id
func MigrateExistingDataToOrganizations(db *gorm.DB) error {
	log.Println("🔄 Iniciando migración de datos existentes a multi-tenencia...")

	// 1. Verificar/Crear organización por defecto
	var defaultOrg models.Organization
	err := db.Where("slug = ?", "default").First(&defaultOrg).Error
	
	if err == gorm.ErrRecordNotFound {
		log.Println("📦 Creando organización por defecto para migración...")
		defaultOrg = models.Organization{
			Name:     "Default Organization",
			Slug:     "default",
			IsActive: true,
		}
		if err := db.Create(&defaultOrg).Error; err != nil {
			log.Printf("❌ Error creando organización por defecto: %v", err)
			return err
		}
		log.Printf("✅ Organización por defecto creada (ID: %d)", defaultOrg.ID)
	} else if err != nil {
		return err
	}

	// 2. Migrar SystemUsers sin organización
	var usersWithoutOrg int64
	db.Model(&models.SystemUser{}).Where("organization_id = 0 OR organization_id IS NULL").Count(&usersWithoutOrg)
	
	if usersWithoutOrg > 0 {
		log.Printf("👤 Migrando %d usuarios sin organización...", usersWithoutOrg)
		result := db.Model(&models.SystemUser{}).
			Where("organization_id = 0 OR organization_id IS NULL").
			Update("organization_id", defaultOrg.ID)
		
		if result.Error != nil {
			log.Printf("❌ Error migrando usuarios: %v", result.Error)
			return result.Error
		}
		log.Printf("✅ %d usuarios migrados a la organización por defecto", result.RowsAffected)
	} else {
		log.Println("✅ No hay usuarios sin organización")
	}

	// 3. Migrar Clients sin organización
	var clientsWithoutOrg int64
	db.Model(&models.Client{}).Where("organization_id = 0 OR organization_id IS NULL").Count(&clientsWithoutOrg)
	
	if clientsWithoutOrg > 0 {
		log.Printf("📞 Migrando %d clientes sin organización...", clientsWithoutOrg)
		result := db.Model(&models.Client{}).
			Where("organization_id = 0 OR organization_id IS NULL").
			Update("organization_id", defaultOrg.ID)
		
		if result.Error != nil {
			log.Printf("❌ Error migrando clientes: %v", result.Error)
			return result.Error
		}
		log.Printf("✅ %d clientes migrados a la organización por defecto", result.RowsAffected)
	} else {
		log.Println("✅ No hay clientes sin organización")
	}

	// 4. Migrar BotInstances sin organización
	var instancesWithoutOrg int64
	db.Model(&models.BotInstance{}).Where("organization_id = 0 OR organization_id IS NULL").Count(&instancesWithoutOrg)
	
	if instancesWithoutOrg > 0 {
		log.Printf("🤖 Migrando %d instancias de bot sin organización...", instancesWithoutOrg)
		result := db.Model(&models.BotInstance{}).
			Where("organization_id = 0 OR organization_id IS NULL").
			Update("organization_id", defaultOrg.ID)
		
		if result.Error != nil {
			log.Printf("❌ Error migrando instancias de bot: %v", result.Error)
			return result.Error
		}
		log.Printf("✅ %d instancias de bot migradas a la organización por defecto", result.RowsAffected)
	} else {
		log.Println("✅ No hay instancias de bot sin organización")
	}

	log.Println("🎉 Migración completada exitosamente!")
	return nil
}