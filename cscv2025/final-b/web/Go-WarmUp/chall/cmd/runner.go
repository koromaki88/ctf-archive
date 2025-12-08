package main

import (
	"go-warmup/config"
	"go-warmup/internal/app/routes"
	"log"

	"github.com/gofiber/fiber/v2"
)

func main() {
	app := fiber.New()
	config.InitConfig()
	routes.SetupRoutes(app)
	log.Fatal(app.Listen(":3000"))
}
