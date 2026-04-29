package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

type ShiftHandler struct {
	DB *pgxpool.Pool
}

const shiftSelectCols = `id::text, supervisor_id::text, date::text, start_time::text, end_time::text, created_at::text`

func scanShift(rows pgx.Rows, s *model.Shift) error {
	return rows.Scan(&s.ID, &s.SupervisorID, &s.Date, &s.StartTime, &s.EndTime, &s.CreatedAt)
}

func (h *ShiftHandler) List(c *gin.Context) {
	query := `SELECT ` + shiftSelectCols + ` FROM shifts`
	args := []any{}

	if date := c.Query("date"); date != "" {
		query += ` WHERE date = $1`
		args = append(args, date)
	}
	query += ` ORDER BY date DESC, start_time`

	rows, err := h.DB.Query(c.Request.Context(), query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	shifts := []model.Shift{}
	for rows.Next() {
		var s model.Shift
		if err := scanShift(rows, &s); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		shifts = append(shifts, s)
	}
	c.JSON(http.StatusOK, shifts)
}

func (h *ShiftHandler) Get(c *gin.Context) {
	rows, err := h.DB.Query(c.Request.Context(),
		`SELECT `+shiftSelectCols+` FROM shifts WHERE id = $1`, c.Param("shiftId"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	if !rows.Next() {
		c.JSON(http.StatusNotFound, gin.H{"error": "shift not found"})
		return
	}
	var s model.Shift
	if err := scanShift(rows, &s); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, s)
}

func (h *ShiftHandler) Create(c *gin.Context) {
	var body struct {
		SupervisorID string `json:"supervisor_id" binding:"required"`
		Date         string `json:"date" binding:"required"`
		StartTime    string `json:"start_time" binding:"required"`
		EndTime      string `json:"end_time" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rows, err := h.DB.Query(c.Request.Context(), `
		INSERT INTO shifts (supervisor_id, date, start_time, end_time)
		VALUES ($1, $2, $3, $4)
		RETURNING `+shiftSelectCols,
		body.SupervisorID, body.Date, body.StartTime, body.EndTime,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	rows.Next()
	var s model.Shift
	if err := scanShift(rows, &s); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, s)
}
