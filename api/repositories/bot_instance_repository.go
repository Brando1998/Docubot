package repositories

import (
	"gorm.io/gorm"

	"github.com/brando1998/docubot-api/models"
)

type BotInstanceRepository interface {
	Create(instance *models.BotInstance) error
	GetAll() ([]models.BotInstance, error)
	GetByID(id uint) (*models.BotInstance, error)
	GetByWhatsAppNumber(number string) (*models.BotInstance, error)
	Delete(id uint) error
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

func (r *botInstanceRepository) GetAll() ([]models.BotInstance, error) {
	var instances []models.BotInstance
	err := r.db.Find(&instances).Error
	return instances, err
}

func (r *botInstanceRepository) GetByID(id uint) (*models.BotInstance, error) {
	var instance models.BotInstance
	err := r.db.First(&instance, id).Error
	return &instance, err
}

func (r *botInstanceRepository) GetByWhatsAppNumber(number string) (*models.BotInstance, error) {
	var instance models.BotInstance
	err := r.db.Where("whatsapp_number = ? AND status = ?", number, "running").First(&instance).Error
	return &instance, err
}

func (r *botInstanceRepository) Delete(id uint) error {
	return r.db.Delete(&models.BotInstance{}, id).Error
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
