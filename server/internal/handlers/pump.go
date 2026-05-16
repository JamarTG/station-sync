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
	businessID := c.GetString("business_id")
	branchID := c.GetString("branch_id")
	rows, err := h.DB.Query(c.Request.Context(),
		`SELECT id::text, COALESCE(branch_id::text,''), name, COALESCE(description,'')
		 FROM pumps
		 WHERE business_id = $1 AND ($2 = '' OR branch_id::text = $2)
		 ORDER BY name`,
		businessID, branchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	pumps := []model.Pump{}
	for rows.Next() {
		var p model.Pump
		if err := rows.Scan(&p.ID, &p.BranchID, &p.Name, &p.Description); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		pumps = append(pumps, p)
	}
	c.JSON(http.StatusOK, pumps)
}

func (h *PumpHandler) Get(c *gin.Context) {
	businessID := c.GetString("business_id")
	var p model.Pump
	err := h.DB.QueryRow(c.Request.Context(),
		`SELECT id::text, COALESCE(branch_id::text,''), name, COALESCE(description,'')
		 FROM pumps WHERE id = $1 AND business_id = $2`,
		c.Param("pumpId"), businessID,
	).Scan(&p.ID, &p.BranchID, &p.Name, &p.Description)
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
	businessID := c.GetString("business_id")
	branchID := c.GetString("branch_id")
	var body struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
		BranchID    string `json:"branch_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.BranchID != "" {
		branchID = body.BranchID
	}
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branch_id required"})
		return
	}

	var p model.Pump
	err := h.DB.QueryRow(c.Request.Context(),
		`INSERT INTO pumps (business_id, branch_id, name, description)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id::text, branch_id::text, name, COALESCE(description,'')`,
		businessID, branchID, body.Name, body.Description,
	).Scan(&p.ID, &p.BranchID, &p.Name, &p.Description)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, p)
}

func (h *PumpHandler) GetFuelSummary(c *gin.Context) {
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT
			f.name,
			ROW_NUMBER() OVER (PARTITION BY n.fuel_id ORDER BY n.id),
			nl.starting_reading,
			nl.ending_reading,
			COALESCE(sfp.price, 0)
		FROM nozzles n
		JOIN fuels f ON n.fuel_id = f.id
		JOIN pumps p ON p.id = n.pump_id AND p.business_id = $3
		JOIN shifts s ON s.id = $2 AND s.business_id = $3
		LEFT JOIN nozzle_logs nl ON nl.nozzle_id = n.id AND nl.shift_id = $2
		LEFT JOIN shift_fuel_prices sfp ON sfp.fuel_id = n.fuel_id AND sfp.shift_id = $2
		WHERE n.pump_id = $1
		ORDER BY f.name, n.id
	`, c.Param("pumpId"), c.Param("shiftId"), businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type NozzleReading struct {
		NozzleNumber   int     `json:"nozzleNumber"`
		OpeningReading float64 `json:"openingReading"`
		ClosingReading float64 `json:"closingReading"`
	}
	type FuelSummary struct {
		FuelType        string          `json:"fuelType"`
		Nozzles         []NozzleReading `json:"nozzles"`
		PricePerLitre   float64         `json:"pricePerLitre"`
		TotalLitresSold float64         `json:"totalLitresSold"`
		TotalSales      float64         `json:"totalSales"`
	}

	summaryMap := map[string]*FuelSummary{}
	order := []string{}

	for rows.Next() {
		var fuelType string
		var nozzleNum int
		var opening, closing *float64
		var price float64

		if err := rows.Scan(&fuelType, &nozzleNum, &opening, &closing, &price); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if _, exists := summaryMap[fuelType]; !exists {
			summaryMap[fuelType] = &FuelSummary{FuelType: fuelType, Nozzles: []NozzleReading{}, PricePerLitre: price}
			order = append(order, fuelType)
		}

		nr := NozzleReading{NozzleNumber: nozzleNum}
		if opening != nil {
			nr.OpeningReading = *opening
		}
		if closing != nil {
			nr.ClosingReading = *closing
		}

		litres := nr.ClosingReading - nr.OpeningReading
		summaryMap[fuelType].Nozzles = append(summaryMap[fuelType].Nozzles, nr)
		summaryMap[fuelType].TotalLitresSold += litres
		summaryMap[fuelType].TotalSales += litres * price
	}

	result := make([]FuelSummary, 0, len(order))
	for _, ft := range order {
		result = append(result, *summaryMap[ft])
	}
	c.JSON(http.StatusOK, result)
}

func (h *PumpHandler) GetShiftFuelSales(c *gin.Context) {
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT f.name AS fuel_type, SUM(nl.ending_reading - nl.starting_reading) AS total_litres
		FROM nozzle_logs nl
		JOIN nozzles n ON nl.nozzle_id = n.id
		JOIN fuels f ON n.fuel_id = f.id
		JOIN pumps p ON p.id = n.pump_id AND p.business_id = $3
		JOIN shifts s ON s.id = nl.shift_id AND s.business_id = $3
		WHERE n.pump_id = $1 AND nl.shift_id = $2
		GROUP BY f.name
	`, c.Param("pumpId"), c.Param("shiftId"), businessID)
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
