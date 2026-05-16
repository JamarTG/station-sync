package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

type FuelHandler struct {
	DB *pgxpool.Pool
}

func (h *FuelHandler) List(c *gin.Context) {
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(),
		`SELECT id::text, name FROM fuels WHERE business_id = $1 ORDER BY name`, businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	fuels := []model.Fuel{}
	for rows.Next() {
		var f model.Fuel
		if err := rows.Scan(&f.ID, &f.Name); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		fuels = append(fuels, f)
	}
	c.JSON(http.StatusOK, fuels)
}

func (h *FuelHandler) ListPumps(c *gin.Context) {
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(),
		`SELECT DISTINCT p.id::text, p.name, p.description
		 FROM pumps p
		 JOIN nozzles n ON n.pump_id = p.id
		 WHERE n.fuel_id = $1 AND p.business_id = $2
		 ORDER BY p.name`,
		c.Param("fuelId"), businessID,
	)
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

func (h *FuelHandler) Create(c *gin.Context) {
	businessID := c.GetString("business_id")
	var body struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var f model.Fuel
	err := h.DB.QueryRow(c.Request.Context(),
		`INSERT INTO fuels (business_id, name) VALUES ($1, $2) RETURNING id::text, name`,
		businessID, body.Name,
	).Scan(&f.ID, &f.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.DB.Exec(c.Request.Context(),
		`INSERT INTO tanks (business_id, fuel_id, name) VALUES ($1, $2, $3) ON CONFLICT (business_id, name) DO NOTHING`,
		businessID, f.ID, f.Name,
	)

	c.JSON(http.StatusCreated, f)
}
