package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

type DepositHandler struct {
	DB *pgxpool.Pool
}

func (h *DepositHandler) ListByShift(c *gin.Context) {
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT d.id::text, d.shift_id::text, d.attendant_id::text, u.name, d.type, d.amount, d.metadata
		FROM deposits d
		JOIN shifts s ON s.id = d.shift_id AND s.business_id = $2
		JOIN users u ON d.attendant_id = u.id
		WHERE d.shift_id = $1
		ORDER BY d.id`,
		c.Param("shiftId"), businessID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	deposits := []model.Deposit{}
	for rows.Next() {
		var d model.Deposit
		if err := rows.Scan(&d.ID, &d.ShiftID, &d.AttendantID, &d.AttendantName, &d.Type, &d.Amount, &d.Metadata); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		deposits = append(deposits, d)
	}
	c.JSON(http.StatusOK, deposits)
}

func (h *DepositHandler) Update(c *gin.Context) {
	businessID := c.GetString("business_id")
	var body struct {
		AttendantID string  `json:"attendant_id" binding:"required"`
		Type        string  `json:"type" binding:"required"`
		Amount      float64 `json:"amount" binding:"required"`
		Metadata    *string `json:"metadata"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var d model.Deposit
	err := h.DB.QueryRow(c.Request.Context(), `
		UPDATE deposits
		SET attendant_id = $3, type = $4, amount = $5, metadata = $6
		WHERE id = $1
		  AND shift_id = $2
		  AND EXISTS (SELECT 1 FROM shifts WHERE id = $2 AND business_id = $7)
		RETURNING id::text, shift_id::text, attendant_id::text,
		  (SELECT name FROM users WHERE id = $3), type, amount, metadata`,
		c.Param("id"), c.Param("shiftId"), body.AttendantID, body.Type, body.Amount, body.Metadata, businessID,
	).Scan(&d.ID, &d.ShiftID, &d.AttendantID, &d.AttendantName, &d.Type, &d.Amount, &d.Metadata)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "deposit not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	c.JSON(http.StatusOK, d)
}

func (h *DepositHandler) Delete(c *gin.Context) {
	businessID := c.GetString("business_id")
	result, err := h.DB.Exec(c.Request.Context(), `
		DELETE FROM deposits
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
		c.JSON(http.StatusNotFound, gin.H{"error": "deposit not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *DepositHandler) Create(c *gin.Context) {
	businessID := c.GetString("business_id")
	var body struct {
		AttendantID string  `json:"attendant_id" binding:"required"`
		Type        string  `json:"type" binding:"required"`
		Amount      float64 `json:"amount" binding:"required"`
		Metadata    *string `json:"metadata"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var d model.Deposit
	err := h.DB.QueryRow(c.Request.Context(), `
		WITH auth AS (SELECT 1 FROM shifts WHERE id = $1 AND business_id = $6)
		INSERT INTO deposits (shift_id, attendant_id, type, amount, metadata)
		SELECT $1, $2, $3, $4, $5 FROM auth
		RETURNING id::text, shift_id::text, attendant_id::text,
		  (SELECT name FROM users WHERE id = $2), type, amount, metadata`,
		c.Param("shiftId"), body.AttendantID, body.Type, body.Amount, body.Metadata, businessID,
	).Scan(&d.ID, &d.ShiftID, &d.AttendantID, &d.AttendantName, &d.Type, &d.Amount, &d.Metadata)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusForbidden, gin.H{"error": "shift not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	c.JSON(http.StatusCreated, d)
}
