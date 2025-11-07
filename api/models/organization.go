package models

import (
	"time"

	"gorm.io/gorm"
)

type Organization struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	Name      string         `json:"name" gorm:"not null"`
	Slug      string         `json:"slug" gorm:"uniqueIndex;not null"` // para URLs amigables
	IsActive  bool           `json:"is_active" gorm:"default:true"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
}