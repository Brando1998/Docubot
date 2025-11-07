package models

import (
	"time"

	"gorm.io/gorm"
)

type SystemUser struct {
	ID             uint           `json:"id" gorm:"primaryKey"`
	OrganizationID uint           `json:"organization_id" gorm:"not null;index"` // 🆕 Multi-tenencia
	Username       string         `json:"username" gorm:"uniqueIndex;not null"`
	Email          string         `json:"email" gorm:"uniqueIndex;not null"`
	PasswordHash   string         `json:"-" gorm:"not null"`        // Nunca exponer esto en JSON
	Role           string         `json:"role" gorm:"default:user"` // user, admin, etc.
	IsActive       bool           `json:"is_active" gorm:"default:true"`
	LastLogin      *time.Time     `json:"last_login"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `json:"-" gorm:"index"`
	Organization Organization `json:"organization,omitempty" gorm:"foreignKey:OrganizationID"`
}