package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

type NozzleLogHandler struct {
	DB *pgxpool.Pool
}

func (h *NozzleLogHandler) ListByShift(c *gin.Context) {
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT id::text, nozzle_id::text, shift_id::text, starting_reading, ending_reading
		FROM nozzle_logs WHERE shift_id = $1`,
		c.Param("shiftId"),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	logs := []model.NozzleLog{}
	for rows.Next() {
		var nl model.NozzleLog
		if err := rows.Scan(&nl.ID, &nl.NozzleID, &nl.ShiftID, &nl.StartingReading, &nl.EndingReading); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		logs = append(logs, nl)
	}
	c.JSON(http.StatusOK, logs)
}

func (h *NozzleLogHandler) Create(c *gin.Context) {
	var body struct {
		NozzleID        string  `json:"nozzle_id" binding:"required"`
		ShiftID         string  `json:"shift_id" binding:"required"`
		StartingReading float64 `json:"starting_reading" binding:"required"`
		EndingReading   float64 `json:"ending_reading" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var nl model.NozzleLog
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO nozzle_logs (nozzle_id, shift_id, starting_reading, ending_reading)
		VALUES ($1, $2, $3, $4)
		RETURNING id::text, nozzle_id::text, shift_id::text, starting_reading, ending_reading`,
		body.NozzleID, body.ShiftID, body.StartingReading, body.EndingReading,
	).Scan(&nl.ID, &nl.NozzleID, &nl.ShiftID, &nl.StartingReading, &nl.EndingReading)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, nl)
}
