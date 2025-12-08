package config

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var DB *mongo.Database
var JwtSecret string

func InitConfig() {
	mongoURI := os.Getenv("MONGO_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://root:password@localhost:27017/go-warmup?authSource=admin"
		log.Printf("MONGO_URI not set, using default: %s", mongoURI)
	}

	client, err := mongo.NewClient(options.Client().ApplyURI(mongoURI))
	if err != nil {
		log.Fatal(err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := client.Connect(ctx); err != nil {
		log.Fatal(err)
	}

	DB = client.Database("go-warmup")
	fmt.Println("Connected to MongoDB")

	randomBytes := make([]byte, 64)
	if _, err := rand.Read(randomBytes); err != nil {
		log.Fatal("Failed to generate random JWT secret")
	}
	JwtSecret = hex.EncodeToString(randomBytes)
	log.Println("Generated random JWT secret")
}
