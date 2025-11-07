package models

import (
	"time"
)

type Client struct {
	ID             uint      `json:"id" gorm:"primaryKey"`
	OrganizationID uint      `json:"organization_id" gorm:"not null;index"` // 🆕 Multi-tenencia
	Name           string    `json:"name"`
	Email          *string   `json:"email" gorm:"uniqueIndex"` // Cambiado a puntero para permitir nil
	Phone          string    `json:"phone" gorm:"uniqueIndex"` // importante para identificar desde WhatsApp
	BotID          uint      `json:"bot_id"`                   // para cuando agregues login
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	Organization Organization `json:"organization,omitempty" gorm:"foreignKey:OrganizationID"`
}