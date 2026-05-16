package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

type TankHandler struct {
	DB *pgxpool.Pool
}

func (h *TankHandler) List(c *gin.Context) {
	businessID := c.GetString("business_id")
	branchID := c.GetString("branch_id")
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT t.id::text, t.business_id::text, COALESCE(t.branch_id::text,''),
		       COALESCE(t.fuel_id::text,''), COALESCE(f.name,''), t.name,
		       COALESCE(t.capacity_litres, 0)
		FROM tanks t
		LEFT JOIN fuels f ON f.id = t.fuel_id
		WHERE t.business_id = $1 AND ($2 = '' OR t.branch_id IS NULL OR t.branch_id::text = $2)
		ORDER BY t.name`,
		businessID, branchID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	tanks := []model.Tank{}
	for rows.Next() {
		var t model.Tank
		if err := rows.Scan(&t.ID, &t.BusinessID, &t.BranchID, &t.FuelID, &t.FuelName, &t.Name, &t.CapacityLitres); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		tanks = append(tanks, t)
	}
	c.JSON(http.StatusOK, tanks)
}

func (h *TankHandler) Create(c *gin.Context) {
	businessID := c.GetString("business_id")
	branchID := c.GetString("branch_id")
	var body struct {
		FuelID         string  `json:"fuel_id"`
		Name           string  `json:"name" binding:"required"`
		CapacityLitres float64 `json:"capacity_litres"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var t model.Tank
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO tanks (business_id, branch_id, fuel_id, name, capacity_litres)
		VALUES ($1, NULLIF($2,'')::uuid, NULLIF($3,'')::uuid, $4, NULLIF($5, 0))
		RETURNING id::text, business_id::text, COALESCE(branch_id::text,''),
		          COALESCE(fuel_id::text,''), '', name, COALESCE(capacity_litres, 0)`,
		businessID, branchID, body.FuelID, body.Name, body.CapacityLitres,
	).Scan(&t.ID, &t.BusinessID, &t.BranchID, &t.FuelID, &t.FuelName, &t.Name, &t.CapacityLitres)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, t)
}
