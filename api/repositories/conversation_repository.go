package repositories

import (
	"context"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/brando1998/docubot-api/models"
)

type ConversationRepository interface {
	SaveMessage(ctx context.Context, userID uint, botID uint, message models.Message) error
	GetConversationByUserID(ctx context.Context, userID uint) (*models.Conversation, error)

	// Nuevos métodos para gestión avanzada
	SaveDocument(ctx context.Context, document models.Document) error
	GetDocumentsByClientID(ctx context.Context, clientID uint) ([]models.Document, error)
	GetDocumentByID(ctx context.Context, documentID string) (*models.Document, error)

	SaveChatMode(ctx context.Context, chatMode models.ChatMode) error
	GetChatMode(ctx context.Context, clientID uint, sessionID string, chatID string) (*models.ChatMode, error)
	UpdateChatMode(ctx context.Context, clientID uint, sessionID string, chatID string, botMode bool) error

	ArchiveChat(ctx context.Context, archive models.ChatArchive) error
	GetArchivedChats(ctx context.Context, clientID uint) ([]models.ChatArchive, error)

	// Exportación de conversaciones
	ExportConversation(ctx context.Context, clientID uint, sessionID string, chatID string) ([]models.Message, error)

	// Métodos para estadísticas
	GetTotalDocuments(ctx context.Context) (int64, error)
	GetDocumentsCreatedBetween(ctx context.Context, startDate, endDate time.Time) ([]models.Document, error)
	GetDocumentsByType(ctx context.Context, startDate, endDate time.Time) (map[string]int, error)
	GetTotalMessages(ctx context.Context) (int64, error)
	GetMessagesBetween(ctx context.Context, startDate, endDate time.Time) ([]models.Message, error)
	GetActiveConversations(ctx context.Context, startDate, endDate time.Time) ([]interface{}, error)
	GetChatsByMode(ctx context.Context, botMode bool, startDate, endDate time.Time) ([]interface{}, error)
	GetChatsInBotMode(ctx context.Context) (int64, error)
	GetChatsInManualMode(ctx context.Context) (int64, error)
	GetArchivedChatsCount(ctx context.Context, startDate, endDate time.Time) (int64, error)
}

type conversationRepository struct {
	collection *mongo.Collection
}

// Constructor
func NewConversationRepository(client *mongo.Client) ConversationRepository {
	collection := client.Database(os.Getenv("MONGO_DB")).Collection("conversations")
	return &conversationRepository{collection}
}

// Implementación de SaveMessage
func (r *conversationRepository) SaveMessage(ctx context.Context, userID uint, botID uint, message models.Message) error {
	filter := bson.M{"user_id": userID, "bot_id": botID}
	update := bson.M{
		"$push": bson.M{"messages": message},
		"$setOnInsert": bson.M{
			"user_id":    userID,
			"bot_id":     botID,
			"created_at": time.Now(),
		},
	}
	opts := options.Update().SetUpsert(true)
	_, err := r.collection.UpdateOne(ctx, filter, update, opts)
	return err
}

// Implementación de GetConversationByUserID
func (r *conversationRepository) GetConversationByUserID(ctx context.Context, userID uint) (*models.Conversation, error) {
	filter := bson.M{"user_id": userID}
	var conversation models.Conversation
	err := r.collection.FindOne(ctx, filter).Decode(&conversation)
	if err != nil {
		return nil, err
	}
	return &conversation, nil
}

// Implementaciones de los nuevos métodos
func (r *conversationRepository) SaveDocument(ctx context.Context, document models.Document) error {
	document.CreatedAt = time.Now()
	document.UpdatedAt = time.Now()
	document.Status = "generating" // Estado inicial

	documentsCollection := r.collection.Database().Collection("documents")
	_, err := documentsCollection.InsertOne(ctx, document)
	return err
}

func (r *conversationRepository) GetDocumentsByClientID(ctx context.Context, clientID uint) ([]models.Document, error) {
	documentsCollection := r.collection.Database().Collection("documents")
	filter := bson.M{"client_id": clientID}

	cursor, err := documentsCollection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var documents []models.Document
	if err = cursor.All(ctx, &documents); err != nil {
		return nil, err
	}
	return documents, nil
}

func (r *conversationRepository) GetDocumentByID(ctx context.Context, documentID string) (*models.Document, error) {
	documentsCollection := r.collection.Database().Collection("documents")
	objID, err := primitive.ObjectIDFromHex(documentID)
	if err != nil {
		return nil, err
	}

	filter := bson.M{"_id": objID}
	var document models.Document
	err = documentsCollection.FindOne(ctx, filter).Decode(&document)
	if err != nil {
		return nil, err
	}
	return &document, nil
}

func (r *conversationRepository) SaveChatMode(ctx context.Context, chatMode models.ChatMode) error {
	chatMode.CreatedAt = time.Now()
	chatMode.UpdatedAt = time.Now()

	chatModesCollection := r.collection.Database().Collection("chat_modes")
	filter := bson.M{
		"client_id":  chatMode.ClientID,
		"session_id": chatMode.SessionID,
		"chat_id":    chatMode.ChatID,
	}
	update := bson.M{
		"$set": bson.M{
			"bot_mode":   chatMode.BotMode,
			"updated_at": time.Now(),
		},
		"$setOnInsert": bson.M{
			"client_id":  chatMode.ClientID,
			"bot_id":     chatMode.BotID,
			"session_id": chatMode.SessionID,
			"chat_id":    chatMode.ChatID,
			"created_at": chatMode.CreatedAt,
		},
	}
	opts := options.Update().SetUpsert(true)
	_, err := chatModesCollection.UpdateOne(ctx, filter, update, opts)
	return err
}

func (r *conversationRepository) GetChatMode(ctx context.Context, clientID uint, sessionID string, chatID string) (*models.ChatMode, error) {
	chatModesCollection := r.collection.Database().Collection("chat_modes")
	filter := bson.M{
		"client_id":  clientID,
		"session_id": sessionID,
		"chat_id":    chatID,
	}

	var chatMode models.ChatMode
	err := chatModesCollection.FindOne(ctx, filter).Decode(&chatMode)
	if err != nil {
		return nil, err
	}
	return &chatMode, nil
}

func (r *conversationRepository) UpdateChatMode(ctx context.Context, clientID uint, sessionID string, chatID string, botMode bool) error {
	chatModesCollection := r.collection.Database().Collection("chat_modes")
	filter := bson.M{
		"client_id":  clientID,
		"session_id": sessionID,
		"chat_id":    chatID,
	}
	update := bson.M{
		"$set": bson.M{
			"bot_mode":   botMode,
			"updated_at": time.Now(),
		},
	}

	_, err := chatModesCollection.UpdateOne(ctx, filter, update)
	return err
}

func (r *conversationRepository) ArchiveChat(ctx context.Context, archive models.ChatArchive) error {
	archive.ArchivedAt = time.Now()

	archivesCollection := r.collection.Database().Collection("chat_archives")
	_, err := archivesCollection.InsertOne(ctx, archive)
	return err
}

func (r *conversationRepository) GetArchivedChats(ctx context.Context, clientID uint) ([]models.ChatArchive, error) {
	archivesCollection := r.collection.Database().Collection("chat_archives")
	filter := bson.M{"client_id": clientID}

	cursor, err := archivesCollection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var archives []models.ChatArchive
	if err = cursor.All(ctx, &archives); err != nil {
		return nil, err
	}
	return archives, nil
}

func (r *conversationRepository) ExportConversation(ctx context.Context, clientID uint, sessionID string, chatID string) ([]models.Message, error) {
	// Buscar mensajes por client_id, session_id y que el sender contenga el chatID
	filter := bson.M{
		"client_id":  clientID,
		"session_id": sessionID,
		"sender":     bson.M{"$regex": chatID, "$options": "i"},
	}

	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var messages []models.Message
	if err = cursor.All(ctx, &messages); err != nil {
		return nil, err
	}
	return messages, nil
}

// Implementaciones de métodos para estadísticas
func (r *conversationRepository) GetTotalDocuments(ctx context.Context) (int64, error) {
	documentsCollection := r.collection.Database().Collection("documents")
	count, err := documentsCollection.CountDocuments(ctx, bson.M{})
	return count, err
}

func (r *conversationRepository) GetDocumentsCreatedBetween(ctx context.Context, startDate, endDate time.Time) ([]models.Document, error) {
	documentsCollection := r.collection.Database().Collection("documents")
	filter := bson.M{
		"created_at": bson.M{
			"$gte": startDate,
			"$lt":  endDate,
		},
	}

	cursor, err := documentsCollection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var documents []models.Document
	if err = cursor.All(ctx, &documents); err != nil {
		return nil, err
	}
	return documents, nil
}

func (r *conversationRepository) GetDocumentsByType(ctx context.Context, startDate, endDate time.Time) (map[string]int, error) {
	documents, err := r.GetDocumentsCreatedBetween(ctx, startDate, endDate)
	if err != nil {
		return nil, err
	}

	result := make(map[string]int)
	for _, doc := range documents {
		result[doc.Type]++
	}
	return result, nil
}

func (r *conversationRepository) GetTotalMessages(ctx context.Context) (int64, error) {
	count, err := r.collection.CountDocuments(ctx, bson.M{})
	return count, err
}

func (r *conversationRepository) GetMessagesBetween(ctx context.Context, startDate, endDate time.Time) ([]models.Message, error) {
	filter := bson.M{
		"timestamp": bson.M{
			"$gte": startDate,
			"$lt":  endDate,
		},
	}

	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var messages []models.Message
	if err = cursor.All(ctx, &messages); err != nil {
		return nil, err
	}
	return messages, nil
}

func (r *conversationRepository) GetActiveConversations(ctx context.Context, startDate, endDate time.Time) ([]interface{}, error) {
	// Agrupar por client_id y contar mensajes en el período
	pipeline := []bson.M{
		{
			"$match": bson.M{
				"timestamp": bson.M{
					"$gte": startDate,
					"$lt":  endDate,
				},
			},
		},
		{
			"$group": bson.M{
				"_id":           "$client_id",
				"message_count": bson.M{"$sum": 1},
				"last_message":  bson.M{"$max": "$timestamp"},
			},
		},
		{
			"$match": bson.M{
				"message_count": bson.M{"$gte": 2}, // Al menos 2 mensajes para considerar conversación activa
			},
		},
	}

	cursor, err := r.collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []interface{}
	if err = cursor.All(ctx, &results); err != nil {
		return nil, err
	}
	return results, nil
}

func (r *conversationRepository) GetChatsInBotMode(ctx context.Context) (int64, error) {
	chatModesCollection := r.collection.Database().Collection("chat_modes")
	count, err := chatModesCollection.CountDocuments(ctx, bson.M{"bot_mode": true})
	return count, err
}

func (r *conversationRepository) GetChatsInManualMode(ctx context.Context) (int64, error) {
	chatModesCollection := r.collection.Database().Collection("chat_modes")
	count, err := chatModesCollection.CountDocuments(ctx, bson.M{"bot_mode": false})
	return count, err
}

func (r *conversationRepository) GetArchivedChatsCount(ctx context.Context, startDate, endDate time.Time) (int64, error) {
	archivesCollection := r.collection.Database().Collection("chat_archives")
	filter := bson.M{
		"archived_at": bson.M{
			"$gte": startDate,
			"$lt":  endDate,
		},
	}
	count, err := archivesCollection.CountDocuments(ctx, filter)
	return count, err
}

func (r *conversationRepository) GetChatsByMode(ctx context.Context, botMode bool, startDate, endDate time.Time) ([]interface{}, error) {
	chatModesCollection := r.collection.Database().Collection("chat_modes")
	filter := bson.M{
		"bot_mode": botMode,
		"created_at": bson.M{
			"$gte": startDate,
			"$lt":  endDate,
		},
	}

	cursor, err := chatModesCollection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []interface{}
	if err = cursor.All(ctx, &results); err != nil {
		return nil, err
	}
	return results, nil
}
