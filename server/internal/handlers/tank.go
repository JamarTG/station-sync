package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

type TankHandler struct {
	DB *pgxpool.Pool
}

func (h *TankHandler) List(c *gin.Context) {
	rows, err := h.DB.Query(c.Request.Context(),
		`SELECT id::text, fuel_id::text, maximum_capacity FROM tanks`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	tanks := []model.Tank{}
	for rows.Next() {
		var t model.Tank
		if err := rows.Scan(&t.ID, &t.FuelID, &t.MaximumCapacity); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		tanks = append(tanks, t)
	}
	c.JSON(http.StatusOK, tanks)
}

func (h *TankHandler) Create(c *gin.Context) {
	var body struct {
		FuelID          string  `json:"fuel_id" binding:"required"`
		MaximumCapacity float64 `json:"maximum_capacity" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var t model.Tank
	err := h.DB.QueryRow(c.Request.Context(),
		`INSERT INTO tanks (fuel_id, maximum_capacity) VALUES ($1, $2)
		 RETURNING id::text, fuel_id::text, maximum_capacity`,
		body.FuelID, body.MaximumCapacity,
	).Scan(&t.ID, &t.FuelID, &t.MaximumCapacity)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, t)
}
