package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

type DepositHandler struct {
	DB *pgxpool.Pool
}

func (h *DepositHandler) ListByShift(c *gin.Context) {
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT id::text, shift_id::text, attendant_id::text, type, amount, metadata
		FROM deposits WHERE shift_id = $1 ORDER BY id`,
		c.Param("shiftId"),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	deposits := []model.Deposit{}
	for rows.Next() {
		var d model.Deposit
		if err := rows.Scan(&d.ID, &d.ShiftID, &d.AttendantID, &d.Type, &d.Amount, &d.Metadata); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		deposits = append(deposits, d)
	}
	c.JSON(http.StatusOK, deposits)
}

func (h *DepositHandler) Create(c *gin.Context) {
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
		INSERT INTO deposits (shift_id, attendant_id, type, amount, metadata)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id::text, shift_id::text, attendant_id::text, type, amount, metadata`,
		c.Param("shiftId"), body.AttendantID, body.Type, body.Amount, body.Metadata,
	).Scan(&d.ID, &d.ShiftID, &d.AttendantID, &d.Type, &d.Amount, &d.Metadata)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, d)
}
