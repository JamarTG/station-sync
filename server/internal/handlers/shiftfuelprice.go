package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

type ShiftFuelPriceHandler struct {
	DB *pgxpool.Pool
}

func (h *ShiftFuelPriceHandler) ListByShift(c *gin.Context) {
	rows, err := h.DB.Query(c.Request.Context(),
		`SELECT fuel_id::text, shift_id::text, price FROM shift_fuel_prices WHERE shift_id = $1`,
		c.Param("shiftId"),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	prices := []model.ShiftFuelPrice{}
	for rows.Next() {
		var p model.ShiftFuelPrice
		if err := rows.Scan(&p.FuelID, &p.ShiftID, &p.Price); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		prices = append(prices, p)
	}
	c.JSON(http.StatusOK, prices)
}

func (h *ShiftFuelPriceHandler) Upsert(c *gin.Context) {
	var body struct {
		FuelID string  `json:"fuel_id" binding:"required"`
		Price  float64 `json:"price" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var p model.ShiftFuelPrice
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO shift_fuel_prices (fuel_id, shift_id, price) VALUES ($1, $2, $3)
		ON CONFLICT (fuel_id, shift_id) DO UPDATE SET price = EXCLUDED.price
		RETURNING fuel_id::text, shift_id::text, price`,
		body.FuelID, c.Param("shiftId"), body.Price,
	).Scan(&p.FuelID, &p.ShiftID, &p.Price)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, p)
}
