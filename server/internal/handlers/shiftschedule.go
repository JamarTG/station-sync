package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

type ShiftScheduleHandler struct {
	DB *pgxpool.Pool
}

const schedSelectCols = `id::text, name, start_time::text, end_time::text, effective_date::text`

func (h *ShiftScheduleHandler) List(c *gin.Context) {
	rows, err := h.DB.Query(c.Request.Context(),
		`SELECT `+schedSelectCols+` FROM shift_schedules ORDER BY effective_date DESC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	schedules := []model.ShiftSchedule{}
	for rows.Next() {
		var s model.ShiftSchedule
		if err := rows.Scan(&s.ID, &s.Name, &s.StartTime, &s.EndTime, &s.EffectiveDate); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		schedules = append(schedules, s)
	}
	c.JSON(http.StatusOK, schedules)
}

func (h *ShiftScheduleHandler) Get(c *gin.Context) {
	var s model.ShiftSchedule
	err := h.DB.QueryRow(c.Request.Context(),
		`SELECT `+schedSelectCols+` FROM shift_schedules WHERE id = $1`, c.Param("id"),
	).Scan(&s.ID, &s.Name, &s.StartTime, &s.EndTime, &s.EffectiveDate)
	if err == pgx.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "shift schedule not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, s)
}

func (h *ShiftScheduleHandler) Create(c *gin.Context) {
	var body struct {
		Name          string `json:"name" binding:"required"`
		StartTime     string `json:"start_time" binding:"required"`
		EndTime       string `json:"end_time" binding:"required"`
		EffectiveDate string `json:"effective_date" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var s model.ShiftSchedule
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO shift_schedules (name, start_time, end_time, effective_date)
		VALUES ($1, $2, $3, $4)
		RETURNING `+schedSelectCols,
		body.Name, body.StartTime, body.EndTime, body.EffectiveDate,
	).Scan(&s.ID, &s.Name, &s.StartTime, &s.EndTime, &s.EffectiveDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, s)
}
