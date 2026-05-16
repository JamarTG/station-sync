package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

type ShiftHandler struct {
	DB *pgxpool.Pool
}

const shiftSelectCols = `id::text, business_id::text, COALESCE(branch_id::text,''), supervisor_id::text, date::text, start_time::text, end_time::text, created_at::text`

func scanShift(rows pgx.Rows, s *model.Shift) error {
	return rows.Scan(&s.ID, &s.BusinessID, &s.BranchID, &s.SupervisorID, &s.Date, &s.StartTime, &s.EndTime, &s.CreatedAt)
}

func (h *ShiftHandler) List(c *gin.Context) {
	businessID := c.GetString("business_id")
	branchID := c.GetString("branch_id")
	query := fmt.Sprintf(`SELECT %s FROM shifts WHERE business_id = $1 AND ($2 = '' OR branch_id::text = $2)`, shiftSelectCols)
	args := []any{businessID, branchID}

	if date := c.Query("date"); date != "" {
		query += ` AND date = $3`
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

func (h *ShiftHandler) GetOpen(c *gin.Context) {
	businessID := c.GetString("business_id")
	branchID := c.GetString("branch_id")
	rows, err := h.DB.Query(c.Request.Context(),
		`SELECT `+shiftSelectCols+` FROM shifts
		 WHERE business_id = $1 AND ($2 = '' OR branch_id::text = $2) AND end_time IS NULL
		 ORDER BY created_at DESC LIMIT 1`, businessID, branchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	if !rows.Next() {
		c.JSON(http.StatusNotFound, gin.H{"error": "no open shift"})
		return
	}
	var s model.Shift
	if err := scanShift(rows, &s); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, s)
}

func (h *ShiftHandler) Get(c *gin.Context) {
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(),
		`SELECT `+shiftSelectCols+` FROM shifts WHERE id = $1 AND business_id = $2`,
		c.Param("shiftId"), businessID)
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
	businessID := c.GetString("business_id")
	branchID := c.GetString("branch_id")
	var body struct {
		SupervisorID string  `json:"supervisor_id" binding:"required"`
		Date         string  `json:"date" binding:"required"`
		StartTime    string  `json:"start_time" binding:"required"`
		EndTime      *string `json:"end_time"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rows, err := h.DB.Query(c.Request.Context(), `
		INSERT INTO shifts (business_id, branch_id, supervisor_id, date, start_time, end_time)
		VALUES ($1, NULLIF($2,'')::uuid, $3, $4, $5, $6)
		RETURNING `+shiftSelectCols,
		businessID, branchID, body.SupervisorID, body.Date, body.StartTime, body.EndTime,
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

	h.DB.Exec(c.Request.Context(),
		`INSERT INTO tank_logs (tank_id, shift_id)
		 SELECT t.id, $1 FROM tanks t WHERE t.business_id = $2
		 ON CONFLICT (tank_id, shift_id) DO NOTHING`,
		s.ID, businessID,
	)

	c.JSON(http.StatusCreated, s)
}

func (h *ShiftHandler) Close(c *gin.Context) {
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(), `
		UPDATE shifts SET end_time = NOW()::time
		WHERE id = $1 AND business_id = $2 AND end_time IS NULL
		RETURNING `+shiftSelectCols,
		c.Param("shiftId"), businessID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	if !rows.Next() {
		c.JSON(http.StatusNotFound, gin.H{"error": "open shift not found"})
		return
	}
	var s model.Shift
	if err := scanShift(rows, &s); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, s)
}
