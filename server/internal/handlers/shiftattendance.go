package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

type ShiftAttendanceHandler struct {
	DB *pgxpool.Pool
}

func (h *ShiftAttendanceHandler) ListByShift(c *gin.Context) {
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT sa.id::text, sa.shift_id::text, sa.user_id::text, u.name,
		       sa.pump_id::text, p.name, sa.clock_in::text, sa.clock_out::text
		FROM shift_attendance sa
		JOIN shifts s ON s.id = sa.shift_id AND s.business_id = $2
		JOIN users u ON sa.user_id = u.id
		LEFT JOIN pumps p ON p.id = sa.pump_id
		WHERE sa.shift_id = $1
		ORDER BY sa.clock_in`,
		c.Param("shiftId"), businessID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	records := []model.ShiftAttendance{}
	for rows.Next() {
		var a model.ShiftAttendance
		if err := rows.Scan(&a.ID, &a.ShiftID, &a.UserID, &a.UserName, &a.PumpID, &a.PumpName, &a.ClockIn, &a.ClockOut); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		records = append(records, a)
	}
	c.JSON(http.StatusOK, records)
}

func (h *ShiftAttendanceHandler) UpdateTimes(c *gin.Context) {
	var body struct {
		ClockIn  string  `json:"clock_in"`
		ClockOut *string `json:"clock_out"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var a model.ShiftAttendance
	err := h.DB.QueryRow(c.Request.Context(), `
		UPDATE shift_attendance
		SET clock_in  = NULLIF($1, '')::timestamptz,
		    clock_out = NULLIF($2, '')::timestamptz
		WHERE id = $3 AND shift_id = $4
		RETURNING id::text, shift_id::text, user_id::text,
		          (SELECT name FROM users WHERE id = user_id),
		          clock_in::text, clock_out::text`,
		body.ClockIn, body.ClockOut, c.Param("id"), c.Param("shiftId"),
	).Scan(&a.ID, &a.ShiftID, &a.UserID, &a.UserName, &a.ClockIn, &a.ClockOut)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "attendance record not found"})
		return
	}
	c.JSON(http.StatusOK, a)
}

func (h *ShiftAttendanceHandler) ClockIn(c *gin.Context) {
	businessID := c.GetString("business_id")
	var body struct {
		UserID  string  `json:"user_id" binding:"required"`
		PumpID  *string `json:"pump_id"`
		ClockIn *string `json:"clock_in"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	clockIn := time.Now().Format(time.RFC3339)
	if body.ClockIn != nil {
		clockIn = *body.ClockIn
	}

	var a model.ShiftAttendance
	err := h.DB.QueryRow(c.Request.Context(), `
		WITH auth AS (SELECT 1 FROM shifts WHERE id = $1 AND business_id = $5)
		INSERT INTO shift_attendance (shift_id, user_id, clock_in, pump_id)
		SELECT $1, $2, $3::timestamptz, $4 FROM auth
		RETURNING id::text, shift_id::text, user_id::text,
		  (SELECT name FROM users WHERE id = $2), pump_id::text, clock_in::text, clock_out::text`,
		c.Param("shiftId"), body.UserID, clockIn, body.PumpID, businessID,
	).Scan(&a.ID, &a.ShiftID, &a.UserID, &a.UserName, &a.PumpID, &a.ClockIn, &a.ClockOut)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "shift not found"})
		return
	}
	c.JSON(http.StatusCreated, a)
}

func (h *ShiftAttendanceHandler) UpdateAttendance(c *gin.Context) {
	businessID := c.GetString("business_id")
	var body struct {
		UserID  string  `json:"user_id" binding:"required"`
		PumpID  *string `json:"pump_id"`
		ClockIn *string `json:"clock_in"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var a model.ShiftAttendance
	err := h.DB.QueryRow(c.Request.Context(), `
		UPDATE shift_attendance
		SET user_id = $3,
		    pump_id = $4,
		    clock_in = COALESCE($5::timestamptz, clock_in)
		WHERE id = $1
		  AND shift_id = $2
		  AND EXISTS (SELECT 1 FROM shifts WHERE id = $2 AND business_id = $6)
		RETURNING id::text, shift_id::text, user_id::text,
		  (SELECT name FROM users WHERE id = $3), pump_id::text, clock_in::text, clock_out::text`,
		c.Param("id"), c.Param("shiftId"), body.UserID, body.PumpID, body.ClockIn, businessID,
	).Scan(&a.ID, &a.ShiftID, &a.UserID, &a.UserName, &a.PumpID, &a.ClockIn, &a.ClockOut)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "attendance record not found"})
		return
	}
	c.JSON(http.StatusOK, a)
}

func (h *ShiftAttendanceHandler) DeleteAttendance(c *gin.Context) {
	businessID := c.GetString("business_id")
	result, err := h.DB.Exec(c.Request.Context(), `
		DELETE FROM shift_attendance
		WHERE id = $1
		  AND shift_id = $2
		  AND EXISTS (SELECT 1 FROM shifts WHERE id = $2 AND business_id = $3)`,
		c.Param("id"), c.Param("shiftId"), businessID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "attendance record not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *ShiftAttendanceHandler) ClockOut(c *gin.Context) {
	businessID := c.GetString("business_id")
	var a model.ShiftAttendance
	err := h.DB.QueryRow(c.Request.Context(), `
		UPDATE shift_attendance sa SET clock_out = NOW()
		FROM shifts s
		WHERE sa.id = $1 AND sa.shift_id = $2 AND s.id = sa.shift_id AND s.business_id = $3
		RETURNING sa.id::text, sa.shift_id::text, sa.user_id::text,
		  (SELECT name FROM users WHERE id = sa.user_id), sa.pump_id::text, sa.clock_in::text, sa.clock_out::text`,
		c.Param("id"), c.Param("shiftId"), businessID,
	).Scan(&a.ID, &a.ShiftID, &a.UserID, &a.UserName, &a.PumpID, &a.ClockIn, &a.ClockOut)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "attendance record not found"})
		return
	}
	c.JSON(http.StatusOK, a)
}
