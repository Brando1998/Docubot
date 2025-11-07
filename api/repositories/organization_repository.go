package repositories

import (
	"errors"

	"gorm.io/gorm"

	"github.com/brando1998/docubot-api/models"
)

type OrganizationRepository interface {
	Create(org *models.Organization) error
	GetByID(id uint) (*models.Organization, error)
	GetBySlug(slug string) (*models.Organization, error)
	GetAll() ([]models.Organization, error)
	Update(org *models.Organization) error
	Delete(id uint) error
}

type organizationRepository struct {
	db *gorm.DB
}

func NewOrganizationRepository(db *gorm.DB) OrganizationRepository {
	return &organizationRepository{db}
}

func (r *organizationRepository) Create(org *models.Organization) error {
	return r.db.Create(org).Error
}

func (r *organizationRepository) GetByID(id uint) (*models.Organization, error) {
	var org models.Organization
	err := r.db.First(&org, id).Error
	if err != nil {
		return nil, err
	}
	return &org, nil
}

func (r *organizationRepository) GetBySlug(slug string) (*models.Organization, error) {
	var org models.Organization
	err := r.db.Where("slug = ?", slug).First(&org).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("organization not found")
		}
		return nil, err
	}
	return &org, nil
}

func (r *organizationRepository) GetAll() ([]models.Organization, error) {
	var orgs []models.Organization
	err := r.db.Find(&orgs).Error
	return orgs, err
}

func (r *organizationRepository) Update(org *models.Organization) error {
	return r.db.Save(org).Error
}

func (r *organizationRepository) Delete(id uint) error {
	return r.db.Delete(&models.Organization{}, id).Error
}