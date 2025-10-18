package models

import "time"

type BotInstance struct {
	ID             uint      `json:"id" gorm:"primaryKey"`
	Name           string    `json:"name" gorm:"uniqueIndex"`
	ContainerID    string    `json:"container_id"`
	Port           int       `json:"port" gorm:"uniqueIndex"`
	Status         string    `json:"status"` // running, stopped, error
	BasedOnBotID   uint      `json:"based_on_bot_id"`
	WhatsAppNumber string    `json:"whatsapp_number" gorm:"index"`
	CreatedBy      uint      `json:"created_by"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}
