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
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT id::text, tank_id::text, shift_id::text,
		       before_volume, after_volume, dispensed_volume, timestamp::text
		FROM tank_logs WHERE shift_id = $1 ORDER BY timestamp`,
		c.Param("shiftId"),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	logs := []model.TankLog{}
	for rows.Next() {
		var tl model.TankLog
		if err := rows.Scan(&tl.ID, &tl.TankID, &tl.ShiftID, &tl.BeforeVolume, &tl.AfterVolume, &tl.DispensedVolume, &tl.Timestamp); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		logs = append(logs, tl)
	}
	c.JSON(http.StatusOK, logs)
}

func (h *TankLogHandler) Create(c *gin.Context) {
	var body struct {
		TankID          string  `json:"tank_id" binding:"required"`
		ShiftID         string  `json:"shift_id" binding:"required"`
		BeforeVolume    float64 `json:"before_volume" binding:"required"`
		AfterVolume     float64 `json:"after_volume" binding:"required"`
		DispensedVolume float64 `json:"dispensed_volume" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var tl model.TankLog
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO tank_logs (tank_id, shift_id, before_volume, after_volume, dispensed_volume)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id::text, tank_id::text, shift_id::text,
		          before_volume, after_volume, dispensed_volume, timestamp::text`,
		body.TankID, body.ShiftID, body.BeforeVolume, body.AfterVolume, body.DispensedVolume,
	).Scan(&tl.ID, &tl.TankID, &tl.ShiftID, &tl.BeforeVolume, &tl.AfterVolume, &tl.DispensedVolume, &tl.Timestamp)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, tl)
}
