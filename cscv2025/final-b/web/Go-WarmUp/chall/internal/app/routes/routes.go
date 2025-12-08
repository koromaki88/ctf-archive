package routes

import (
	"go-warmup/internal/app/controllers"
	"go-warmup/internal/app/middleware"

	"github.com/gofiber/fiber/v2"
)

func SetupRoutes(app *fiber.App) {
	public := app.Group("/api/v1")
	public.Post("/register", controllers.Register)
	public.Post("/login", controllers.Login)

	protected := app.Group("/api/v2", middleware.Protect)
	protected.Get("/data", middleware.AdminOnly, controllers.FetchData)
}
