package mocks

import (
	"context"
	"time"

	"github.com/brando1998/docubot-api/models"
	"github.com/brando1998/docubot-api/repositories"
)

type MockClientRepo struct {
	CreateClientFunc      func(user *models.Client) error
	GetClientByIDFunc     func(id uint) (*models.Client, error)
	GetClientByPhoneFunc  func(phone string) (*models.Client, error)
	GetOrCreateClientFunc func(phone, name, email string) (*models.Client, error)
}

func (m *MockClientRepo) CreateClient(user *models.Client) error {
	return m.CreateClientFunc(user)
}

func (m *MockClientRepo) GetClientByID(id uint) (*models.Client, error) {
	return m.GetClientByIDFunc(id)
}

func (m *MockClientRepo) GetClientByPhone(phone string) (*models.Client, error) {
	return m.GetClientByPhone(phone)
}

func (m *MockClientRepo) GetOrCreateClient(phone, name, email string) (*models.Client, error) {
	return m.GetOrCreateClient(phone, name, email)
}

var _ repositories.ClientRepository = &MockClientRepo{} // asegura que implementa la interfaz

// Implementación de los nuevos métodos para estadísticas
func (m *MockClientRepo) GetTotalClients(ctx context.Context) (int64, error) {
	return 10, nil
}

func (m *MockClientRepo) GetClientsCreatedBetween(ctx context.Context, startDate, endDate time.Time) ([]models.Client, error) {
	return []models.Client{}, nil
}
