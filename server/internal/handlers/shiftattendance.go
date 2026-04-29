package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

type ShiftAttendanceHandler struct {
	DB *pgxpool.Pool
}

func (h *ShiftAttendanceHandler) ListByShift(c *gin.Context) {
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT id::text, shift_id::text, user_id::text, clock_in::text, clock_out::text
		FROM shift_attendance WHERE shift_id = $1 ORDER BY clock_in`,
		c.Param("shiftId"),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	records := []model.ShiftAttendance{}
	for rows.Next() {
		var a model.ShiftAttendance
		if err := rows.Scan(&a.ID, &a.ShiftID, &a.UserID, &a.ClockIn, &a.ClockOut); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		records = append(records, a)
	}
	c.JSON(http.StatusOK, records)
}

func (h *ShiftAttendanceHandler) ClockIn(c *gin.Context) {
	var body struct {
		UserID string `json:"user_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var a model.ShiftAttendance
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO shift_attendance (shift_id, user_id)
		VALUES ($1, $2)
		RETURNING id::text, shift_id::text, user_id::text, clock_in::text, clock_out::text`,
		c.Param("shiftId"), body.UserID,
	).Scan(&a.ID, &a.ShiftID, &a.UserID, &a.ClockIn, &a.ClockOut)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, a)
}

func (h *ShiftAttendanceHandler) ClockOut(c *gin.Context) {
	var a model.ShiftAttendance
	err := h.DB.QueryRow(c.Request.Context(), `
		UPDATE shift_attendance SET clock_out = NOW()
		WHERE id = $1 AND shift_id = $2
		RETURNING id::text, shift_id::text, user_id::text, clock_in::text, clock_out::text`,
		c.Param("id"), c.Param("shiftId"),
	).Scan(&a.ID, &a.ShiftID, &a.UserID, &a.ClockIn, &a.ClockOut)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "attendance record not found"})
		return
	}
	c.JSON(http.StatusOK, a)
}
