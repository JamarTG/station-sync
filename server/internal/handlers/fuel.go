package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

type FuelHandler struct {
	DB *pgxpool.Pool
}

func (h *FuelHandler) List(c *gin.Context) {
	rows, err := h.DB.Query(c.Request.Context(),
		`SELECT id::text, name FROM fuels ORDER BY name`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	fuels := []model.Fuel{}
	for rows.Next() {
		var f model.Fuel
		if err := rows.Scan(&f.ID, &f.Name); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		fuels = append(fuels, f)
	}
	c.JSON(http.StatusOK, fuels)
}

func (h *FuelHandler) Create(c *gin.Context) {
	var body struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var f model.Fuel
	err := h.DB.QueryRow(c.Request.Context(),
		`INSERT INTO fuels (name) VALUES ($1) RETURNING id::text, name`,
		body.Name,
	).Scan(&f.ID, &f.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, f)
}
