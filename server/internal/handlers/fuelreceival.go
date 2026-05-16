package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

type FuelReceivalHandler struct {
	DB *pgxpool.Pool
}

func (h *FuelReceivalHandler) ListByShift(c *gin.Context) {
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT fr.id::text, fr.shift_id::text, fr.tank_id::text, fr.fuel_name,
		       fr.litres_ordered, fr.opening_level, fr.closing_level,
		       fr.rate, fr.haulage, fr.gct, fr.invoice_no
		FROM fuel_receivals fr
		JOIN shifts s ON s.id = fr.shift_id AND s.business_id = $2
		WHERE fr.shift_id = $1
		ORDER BY fr.created_at`,
		c.Param("shiftId"), businessID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	receivals := []model.FuelReceival{}
	for rows.Next() {
		var fr model.FuelReceival
		if err := rows.Scan(&fr.ID, &fr.ShiftID, &fr.TankID, &fr.FuelName,
			&fr.LitresOrdered, &fr.OpeningLevel, &fr.ClosingLevel,
			&fr.Rate, &fr.Haulage, &fr.Gct, &fr.InvoiceNo); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		receivals = append(receivals, fr)
	}
	c.JSON(http.StatusOK, receivals)
}

func (h *FuelReceivalHandler) Create(c *gin.Context) {
	businessID := c.GetString("business_id")
	var body struct {
		TankID        *string  `json:"tank_id"`
		FuelName      string   `json:"fuel_name" binding:"required"`
		LitresOrdered float64  `json:"litres_ordered" binding:"required"`
		OpeningLevel  *float64 `json:"opening_level"`
		ClosingLevel  *float64 `json:"closing_level"`
		Rate          *float64 `json:"rate"`
		Haulage       *float64 `json:"haulage"`
		Gct           *float64 `json:"gct"`
		InvoiceNo     *string  `json:"invoice_no"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var fr model.FuelReceival
	err := h.DB.QueryRow(c.Request.Context(), `
		WITH auth AS (SELECT 1 FROM shifts WHERE id = $1 AND business_id = $2)
		INSERT INTO fuel_receivals
		  (shift_id, tank_id, fuel_name, litres_ordered, opening_level, closing_level, rate, haulage, gct, invoice_no)
		SELECT $1, $3, $4, $5, $6, $7, $8, $9, $10, $11 FROM auth
		ON CONFLICT (shift_id, fuel_name) DO UPDATE SET
		  tank_id = EXCLUDED.tank_id,
		  litres_ordered = EXCLUDED.litres_ordered,
		  opening_level = EXCLUDED.opening_level,
		  closing_level = EXCLUDED.closing_level,
		  rate = EXCLUDED.rate,
		  haulage = EXCLUDED.haulage,
		  gct = EXCLUDED.gct,
		  invoice_no = EXCLUDED.invoice_no
		RETURNING id::text, shift_id::text, tank_id::text, fuel_name,
		  litres_ordered, opening_level, closing_level, rate, haulage, gct, invoice_no`,
		c.Param("shiftId"), businessID,
		body.TankID, body.FuelName, body.LitresOrdered,
		body.OpeningLevel, body.ClosingLevel,
		body.Rate, body.Haulage, body.Gct, body.InvoiceNo,
	).Scan(&fr.ID, &fr.ShiftID, &fr.TankID, &fr.FuelName,
		&fr.LitresOrdered, &fr.OpeningLevel, &fr.ClosingLevel,
		&fr.Rate, &fr.Haulage, &fr.Gct, &fr.InvoiceNo)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "shift not found"})
		return
	}
	c.JSON(http.StatusCreated, fr)
}
