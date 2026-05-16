package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

type NozzleHandler struct {
	DB *pgxpool.Pool
}

func (h *NozzleHandler) List(c *gin.Context) {
	businessID := c.GetString("business_id")
	branchID := c.GetString("branch_id")
	rows, err := h.DB.Query(c.Request.Context(),
		`SELECT n.id::text, n.pump_id::text, n.fuel_id::text, f.name
		 FROM nozzles n
		 JOIN fuels f ON f.id = n.fuel_id
		 JOIN pumps p ON p.id = n.pump_id
		   AND p.business_id = $1
		   AND ($2 = '' OR p.branch_id::text = $2)
		 ORDER BY f.name, p.name, n.id`,
		businessID, branchID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	nozzles := []model.Nozzle{}
	for rows.Next() {
		var n model.Nozzle
		if err := rows.Scan(&n.ID, &n.PumpID, &n.FuelID, &n.FuelName); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		nozzles = append(nozzles, n)
	}
	c.JSON(http.StatusOK, nozzles)
}

func (h *NozzleHandler) ListByPump(c *gin.Context) {
	rows, err := h.DB.Query(c.Request.Context(),
		`SELECT n.id::text, n.pump_id::text, n.fuel_id::text, f.name
		 FROM nozzles n
		 JOIN fuels f ON f.id = n.fuel_id
		 WHERE n.pump_id = $1
		 ORDER BY f.name, n.id`,
		c.Param("pumpId"),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	nozzles := []model.Nozzle{}
	for rows.Next() {
		var n model.Nozzle
		if err := rows.Scan(&n.ID, &n.PumpID, &n.FuelID, &n.FuelName); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		nozzles = append(nozzles, n)
	}
	c.JSON(http.StatusOK, nozzles)
}

func (h *NozzleHandler) Create(c *gin.Context) {
	var body struct {
		FuelID string `json:"fuel_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var n model.Nozzle
	err := h.DB.QueryRow(c.Request.Context(),
		`INSERT INTO nozzles (pump_id, fuel_id) VALUES ($1, $2)
		 RETURNING id::text, pump_id::text, fuel_id::text`,
		c.Param("pumpId"), body.FuelID,
	).Scan(&n.ID, &n.PumpID, &n.FuelID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, n)
}
