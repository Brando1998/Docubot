package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Message struct {
	ID        primitive.ObjectID `bson:"_id,omitempty"`
	ClientID  uint               `bson:"client_id"`
	BotID     uint               `bson:"bot_id"`
	Sender    string             `bson:"sender"` // "user" o "bot"
	Text      string             `bson:"text"`
	Timestamp time.Time          `bson:"timestamp"`
	SessionID string             `bson:"session_id,omitempty"`
}

type Conversation struct {
	ID        primitive.ObjectID `bson:"_id,omitempty"`
	UserID    uint               `bson:"client_id"`
	BotID     uint               `bson:"bot_id"`
	Messages  []Message          `bson:"messages"`
	CreatedAt time.Time          `bson:"created_at"`
}

type Document struct {
	ID        primitive.ObjectID     `bson:"_id,omitempty"`
	ClientID  uint                   `bson:"client_id"`
	BotID     uint                   `bson:"bot_id,omitempty"`
	SessionID string                 `bson:"session_id,omitempty"`
	FileName  string                 `bson:"file_name"`
	URL       string                 `bson:"url"`
	Type      string                 `bson:"type"`               // Ej: "manifiesto", "certificado"
	Metadata  map[string]interface{} `bson:"metadata,omitempty"` // Datos usados para generar el documento
	Entities  map[string]interface{} `bson:"entities,omitempty"` // Entidades/slots del formulario
	Status    string                 `bson:"status"`             // "generating", "completed", "failed"
	CreatedAt time.Time              `bson:"created_at"`
	UpdatedAt time.Time              `bson:"updated_at"`
}

type ChatMode struct {
	ID        primitive.ObjectID `bson:"_id,omitempty"`
	ClientID  uint               `bson:"client_id"`
	BotID     uint               `bson:"bot_id,omitempty"`
	SessionID string             `bson:"session_id,omitempty"`
	ChatID    string             `bson:"chat_id"`  // ID del chat en WhatsApp
	BotMode   bool               `bson:"bot_mode"` // true = modo bot, false = modo usuario
	CreatedAt time.Time          `bson:"created_at"`
	UpdatedAt time.Time          `bson:"updated_at"`
}

type ChatArchive struct {
	ID         primitive.ObjectID `bson:"_id,omitempty"`
	ClientID   uint               `bson:"client_id"`
	BotID      uint               `bson:"bot_id,omitempty"`
	SessionID  string             `bson:"session_id,omitempty"`
	ChatID     string             `bson:"chat_id"`
	ChatName   string             `bson:"chat_name"`
	IsGroup    bool               `bson:"is_group"`
	ArchivedAt time.Time          `bson:"archived_at"`
}
