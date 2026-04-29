package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

type PumpHandler struct {
	DB *pgxpool.Pool
}

func (h *PumpHandler) List(c *gin.Context) {
	rows, err := h.DB.Query(c.Request.Context(),
		`SELECT id::text, name, description FROM pumps ORDER BY name`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	pumps := []model.Pump{}
	for rows.Next() {
		var p model.Pump
		if err := rows.Scan(&p.ID, &p.Name, &p.Description); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		pumps = append(pumps, p)
	}
	c.JSON(http.StatusOK, pumps)
}

func (h *PumpHandler) Get(c *gin.Context) {
	var p model.Pump
	err := h.DB.QueryRow(c.Request.Context(),
		`SELECT id::text, name, description FROM pumps WHERE id = $1`,
		c.Param("pumpId"),
	).Scan(&p.ID, &p.Name, &p.Description)
	if err == pgx.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "pump not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *PumpHandler) Create(c *gin.Context) {
	var body struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var p model.Pump
	err := h.DB.QueryRow(c.Request.Context(),
		`INSERT INTO pumps (name, description) VALUES ($1, $2)
		 RETURNING id::text, name, description`,
		body.Name, body.Description,
	).Scan(&p.ID, &p.Name, &p.Description)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, p)
}

func (h *PumpHandler) GetShiftFuelSales(c *gin.Context) {
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT f.name AS fuel_type, SUM(nl.ending_reading - nl.starting_reading) AS total_litres
		FROM nozzle_logs nl
		JOIN nozzles n ON nl.nozzle_id = n.id
		JOIN fuels f ON n.fuel_id = f.id
		WHERE n.pump_id = $1 AND nl.shift_id = $2
		GROUP BY f.name
	`, c.Param("pumpId"), c.Param("shiftId"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type FuelSale struct {
		FuelType    string  `json:"fuel_type"`
		TotalLitres float64 `json:"total_litres"`
	}

	results := []FuelSale{}
	for rows.Next() {
		var fs FuelSale
		if err := rows.Scan(&fs.FuelType, &fs.TotalLitres); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		results = append(results, fs)
	}
	c.JSON(http.StatusOK, results)
}
