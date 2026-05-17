package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

type TankLogHandler struct {
	DB *pgxpool.Pool
}

func (h *TankLogHandler) ListByShift(c *gin.Context) {
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT tl.id::text, tl.tank_id::text, tl.shift_id::text,
		       tl.opening_level, tl.closing_level, tl.delivery_litres
		FROM tank_logs tl
		JOIN shifts s ON s.id = tl.shift_id AND s.business_id = $2
		WHERE tl.shift_id = $1`,
		c.Param("shiftId"), businessID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	logs := []model.TankLog{}
	for rows.Next() {
		var tl model.TankLog
		if err := rows.Scan(&tl.ID, &tl.TankID, &tl.ShiftID, &tl.OpeningLevel, &tl.ClosingLevel, &tl.DeliveryLitres); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		logs = append(logs, tl)
	}
	c.JSON(http.StatusOK, logs)
}

func (h *TankLogHandler) Upsert(c *gin.Context) {
	businessID := c.GetString("business_id")
	var body struct {
		TankID         string   `json:"tank_id" binding:"required"`
		OpeningLevel   *float64 `json:"opening_level"`
		ClosingLevel   *float64 `json:"closing_level"`
		DeliveryLitres *float64 `json:"delivery_litres"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var exists bool
	if err := h.DB.QueryRow(c.Request.Context(),
		`SELECT EXISTS (
			SELECT 1 FROM shifts s
			JOIN tanks t ON t.business_id = s.business_id
			WHERE s.id = $1 AND s.business_id = $2 AND t.id = $3
		)`,
		c.Param("shiftId"), businessID, body.TankID,
	).Scan(&exists); err != nil || !exists {
		c.JSON(http.StatusForbidden, gin.H{"error": "shift or tank not found"})
		return
	}

	var tl model.TankLog
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO tank_logs (tank_id, shift_id, opening_level, closing_level, delivery_litres)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (tank_id, shift_id) DO UPDATE SET
		  opening_level   = COALESCE(EXCLUDED.opening_level,   tank_logs.opening_level),
		  closing_level   = COALESCE(EXCLUDED.closing_level,   tank_logs.closing_level),
		  delivery_litres = COALESCE(EXCLUDED.delivery_litres, tank_logs.delivery_litres)
		RETURNING id::text, tank_id::text, shift_id::text,
		          opening_level, closing_level, delivery_litres`,
		body.TankID, c.Param("shiftId"), body.OpeningLevel, body.ClosingLevel, body.DeliveryLitres,
	).Scan(&tl.ID, &tl.TankID, &tl.ShiftID, &tl.OpeningLevel, &tl.ClosingLevel, &tl.DeliveryLitres)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, tl)
}
