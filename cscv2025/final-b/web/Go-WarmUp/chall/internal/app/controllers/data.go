package controllers

import (
	"context"
	"fmt"
	"time"

	"go-warmup/config"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
)

func FetchData(c *fiber.Ctx) error {
	filterParam := c.Query("filter")
	if filterParam == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Filter query parameter is required"})
	}
	filterStr := fmt.Sprintf("{\"username\":\"bob\",\"address\": \"%s\"}", filterParam)

	var filter bson.M
	if err := bson.UnmarshalExtJSON([]byte(filterStr), true, &filter); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid filter format"})
	}
	collection := config.DB.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	count, err := collection.CountDocuments(ctx, filter)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"count": count,
	})
}
