package main

import (
	"context"
	"log"
	"mime"
	"net/http"
	"os"
	"shiba-api/api"
	"shiba-api/structs"
	"shiba-api/sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
	"github.com/mehanizm/airtable"
)

func NewServer(s3c *s3.Client, localStorageDir, gamesPrefix string) *structs.Server {
	return &structs.Server{
		S3Client: s3c,
		AirtableClient: airtable.NewClient(
			os.Getenv("AIRTABLE_API_KEY"),
		),
		AdminToken: os.Getenv("ADMIN_TOKEN"),
	}
}

func init() {
	mime.AddExtensionType(".js", "application/javascript")
	mime.AddExtensionType(".mjs", "application/javascript")
	mime.AddExtensionType(".wasm", "application/wasm")
	mime.AddExtensionType(".json", "application/json")
	mime.AddExtensionType(".pck", "application/octet-stream") // Godot packs
	mime.AddExtensionType(".ogg", "audio/ogg")
	mime.AddExtensionType(".png", "image/png")
	mime.AddExtensionType(".jpg", "image/jpeg")
	mime.AddExtensionType(".jpeg", "image/jpeg")
}

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Printf("Error loading .env file")
	}

	r2AccessKey := os.Getenv("R2_ACCESS_KEY_ID")
	r2SecretKey := os.Getenv("R2_SECRET_ACCESS_KEY")
	r2Region := os.Getenv("R2_REGION")
	r2Endpoint := os.Getenv("R2_ENDPOINT")

	if r2AccessKey == "" || r2SecretKey == "" || r2Region == "" || r2Endpoint == "" {
		log.Fatal("R2 credentials and endpoint must be set in environment variables")
	}

	log.Println("----------------------------")
	log.Println("Shiba API")
	log.Println("^-^")
	log.Println("-----------------------------")
	log.Printf("R2 Access Key: %s\n", r2AccessKey)
	log.Printf("R2 Secret Key: %s\n", r2SecretKey)
	log.Printf("R2 Region: %s\n", r2Region)
	log.Printf("R2 Endpoint: %s\n", r2Endpoint)
	log.Println("-----------------------------")
	log.Println("Initializing the server...")

	// Make the s3 client with R2 credentials

	cfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			r2AccessKey, r2SecretKey, "",
		)),
		config.WithRegion("auto"),
	)
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	s3Client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(r2Endpoint)
	})

	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	srv := NewServer(s3Client, "./local_storage", "games")

	srv.AirtableBaseTable = srv.AirtableClient.GetTable(os.Getenv("AIRTABLE_BASE_ID"), "Users")
	if srv.AirtableBaseTable == nil {
		log.Fatal("Failed to get Airtable base table")
	}
	log.Println("Adding the airtable base...")

	go func() {
		ticker := time.NewTicker(10 * time.Minute) // interval
		defer ticker.Stop()

		for {
			log.Println("Starting background R2 sync...")
			if err := sync.SyncFromR2(*srv); err != nil {
				log.Printf("R2 sync error: %v", err)
			} else {
				log.Println("R2 sync completed successfully")
			}
			<-ticker.C
		}
	}()

	r := chi.NewRouter()

	// Cors setup

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		AllowCredentials: true,
		MaxAge:           600,
	}))

	api.SetupRoutes(r, srv)

	log.Println("Listening on :3001")
	if err := http.ListenAndServe(":3001", r); err != nil {
		log.Fatal(err)
	}
}
