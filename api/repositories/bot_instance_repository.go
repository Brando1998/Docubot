package repositories

import (
	"gorm.io/gorm"

	"github.com/brando1998/docubot-api/models"
)

type BotInstanceRepository interface {
	Create(instance *models.BotInstance) error
	GetAll(orgID uint) ([]models.BotInstance, error) // 🆕 Agregado orgID
	GetByID(id uint, orgID uint) (*models.BotInstance, error) // 🆕 Agregado orgID
	GetByWhatsAppNumber(number string, orgID uint) (*models.BotInstance, error) // 🆕 Agregado orgID
	Delete(id uint, orgID uint) error // 🆕 Agregado orgID
	GetNextAvailablePort() (int, error)
}

type botInstanceRepository struct {
	db *gorm.DB
}

func NewBotInstanceRepository(db *gorm.DB) BotInstanceRepository {
	return &botInstanceRepository{db}
}

func (r *botInstanceRepository) Create(instance *models.BotInstance) error {
	return r.db.Create(instance).Error
}

// 🆕 Modificado para filtrar por organización
func (r *botInstanceRepository) GetAll(orgID uint) ([]models.BotInstance, error) {
	var instances []models.BotInstance
	err := r.db.Where("organization_id = ?", orgID).Find(&instances).Error
	return instances, err
}

// 🆕 Modificado para filtrar por organización
func (r *botInstanceRepository) GetByID(id uint, orgID uint) (*models.BotInstance, error) {
	var instance models.BotInstance
	err := r.db.Where("id = ? AND organization_id = ?", id, orgID).First(&instance).Error
	return &instance, err
}

// 🆕 Modificado para filtrar por organización
func (r *botInstanceRepository) GetByWhatsAppNumber(number string, orgID uint) (*models.BotInstance, error) {
	var instance models.BotInstance
	err := r.db.Where("whatsapp_number = ? AND status = ? AND organization_id = ?", number, "running", orgID).First(&instance).Error
	return &instance, err
}

// 🆕 Modificado para filtrar por organización
func (r *botInstanceRepository) Delete(id uint, orgID uint) error {
	return r.db.Where("id = ? AND organization_id = ?", id, orgID).Delete(&models.BotInstance{}).Error
}

func (r *botInstanceRepository) GetNextAvailablePort() (int, error) {
	var lastInstance models.BotInstance
	err := r.db.Order("port DESC").First(&lastInstance).Error

	if err == gorm.ErrRecordNotFound {
		return 6000, nil // Puerto inicial
	}

	if err != nil {
		return 0, err
	}

	return lastInstance.Port + 1, nil
}