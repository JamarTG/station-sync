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
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT sfp.fuel_id::text, sfp.shift_id::text, sfp.price, f.name
		FROM shift_fuel_prices sfp
		JOIN shifts s ON s.id = sfp.shift_id AND s.business_id = $2
		JOIN fuels f ON sfp.fuel_id = f.id
		WHERE sfp.shift_id = $1`,
		c.Param("shiftId"), businessID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	prices := []model.ShiftFuelPrice{}
	for rows.Next() {
		var p model.ShiftFuelPrice
		if err := rows.Scan(&p.FuelID, &p.ShiftID, &p.Price, &p.FuelName); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		prices = append(prices, p)
	}
	c.JSON(http.StatusOK, prices)
}

func (h *ShiftFuelPriceHandler) Upsert(c *gin.Context) {
	businessID := c.GetString("business_id")
	var body struct {
		FuelID string  `json:"fuel_id" binding:"required"`
		Price  float64 `json:"price" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var exists bool
	if err := h.DB.QueryRow(c.Request.Context(),
		`SELECT EXISTS (SELECT 1 FROM shifts WHERE id = $1 AND business_id = $2)`,
		c.Param("shiftId"), businessID,
	).Scan(&exists); err != nil || !exists {
		c.JSON(http.StatusForbidden, gin.H{"error": "shift not found"})
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
