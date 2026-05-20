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
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT nl.id::text, nl.nozzle_id::text, nl.shift_id::text, nl.starting_reading, nl.ending_reading
		FROM nozzle_logs nl
		JOIN shifts s ON s.id = nl.shift_id AND s.business_id = $2
		WHERE nl.shift_id = $1`,
		c.Param("shiftId"), businessID,
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
	businessID := c.GetString("business_id")
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
		WITH auth AS (
			SELECT 1
			FROM nozzles n
			JOIN pumps p ON p.id = n.pump_id AND p.business_id = $5
			JOIN shifts s ON s.id = $2 AND s.business_id = $5
			WHERE n.id = $1
		)
		INSERT INTO nozzle_logs (nozzle_id, shift_id, starting_reading, ending_reading)
		SELECT $1, $2, $3, $4 FROM auth
		ON CONFLICT (nozzle_id, shift_id) DO UPDATE
			SET starting_reading = EXCLUDED.starting_reading,
			    ending_reading   = EXCLUDED.ending_reading
		RETURNING id::text, nozzle_id::text, shift_id::text, starting_reading, ending_reading`,
		body.NozzleID, body.ShiftID, body.StartingReading, body.EndingReading, businessID,
	).Scan(&nl.ID, &nl.NozzleID, &nl.ShiftID, &nl.StartingReading, &nl.EndingReading)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "nozzle or shift not found"})
		return
	}
	c.JSON(http.StatusCreated, nl)
}
