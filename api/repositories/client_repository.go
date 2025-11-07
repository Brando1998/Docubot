package repositories

import (
	"context"
	"errors"
	"log"
	"time"

	"gorm.io/gorm"

	"github.com/brando1998/docubot-api/models"
)

type ClientRepository interface {
	CreateClient(user *models.Client) error
	GetClientByID(id uint, orgID uint) (*models.Client, error) // 🆕 Agregado orgID
	GetClientByPhone(phone string, orgID uint) (*models.Client, error) // 🆕 Agregado orgID
	GetOrCreateClient(phone, name, email string, orgID uint) (*models.Client, error) // 🆕 Agregado orgID
	GetAllClients(orgID uint) ([]models.Client, error) // 🆕 Nuevo método

	// Métodos para estadísticas
	GetTotalClients(ctx context.Context, orgID uint) (int64, error) // 🆕 Agregado orgID
	GetClientsCreatedBetween(ctx context.Context, startDate, endDate time.Time, orgID uint) ([]models.Client, error) // 🆕 Agregado orgID
}

type userRepository struct {
	db *gorm.DB
}

func NewClientRepository(db *gorm.DB) ClientRepository {
	return &userRepository{db}
}

func (r *userRepository) CreateClient(user *models.Client) error {
	return r.db.Create(user).Error
}

// 🆕 Modificado para filtrar por organización
func (r *userRepository) GetClientByID(id uint, orgID uint) (*models.Client, error) {
	var user models.Client
	err := r.db.Where("id = ? AND organization_id = ?", id, orgID).First(&user).Error
	return &user, err
}

// 🆕 Modificado para filtrar por organización
func (r *userRepository) GetClientByPhone(phone string, orgID uint) (*models.Client, error) {
	var user models.Client
	err := r.db.Where("phone = ? AND organization_id = ?", phone, orgID).First(&user).Error
	return &user, err
}

// 🆕 Modificado para incluir orgID
func (r *userRepository) GetOrCreateClient(phone, name, email string, orgID uint) (*models.Client, error) {
	var user models.Client
	err := r.db.Where("phone = ? AND organization_id = ?", phone, orgID).First(&user).Error

	if err == nil {
		return &user, nil
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		log.Printf("Cliente no encontrado, creando nuevo con phone: %s para org: %d", phone, orgID)

		var emailPtr *string
		if email != "" {
			emailPtr = &email
		}

		user = models.Client{
			OrganizationID: orgID,
			Phone:          phone,
			Name:           name,
			Email:          emailPtr,
		}

		if createErr := r.db.Create(&user).Error; createErr != nil {
			log.Printf("Error creando cliente: %v", createErr)
			return nil, createErr
		}
		return &user, nil
	}

	log.Printf("Error buscando cliente: %v", err)
	return nil, err
}

// 🆕 Nuevo método para obtener todos los clientes de una organización
func (r *userRepository) GetAllClients(orgID uint) ([]models.Client, error) {
	var clients []models.Client
	err := r.db.Where("organization_id = ?", orgID).Find(&clients).Error
	return clients, err
}

// 🆕 Modificado para filtrar por organización
func (r *userRepository) GetTotalClients(ctx context.Context, orgID uint) (int64, error) {
	var count int64
	err := r.db.Model(&models.Client{}).Where("organization_id = ?", orgID).Count(&count).Error
	return count, err
}

// 🆕 Modificado para filtrar por organización
func (r *userRepository) GetClientsCreatedBetween(ctx context.Context, startDate, endDate time.Time, orgID uint) ([]models.Client, error) {
	var clients []models.Client
	err := r.db.Where("created_at BETWEEN ? AND ? AND organization_id = ?", startDate, endDate, orgID).Find(&clients).Error
	return clients, err
}