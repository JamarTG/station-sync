package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

type ProductHandler struct {
	DB *pgxpool.Pool
}

// productCols is for SELECT queries that alias the table as "p"
const productCols = `p.id::text, p.business_id::text, p.branch_id::text, p.name, p.category, p.sku, p.price, p.cost, p.stock_qty, p.unit, p.active, p.created_at::text`

// returnCols is for RETURNING clauses (INSERT / UPDATE) where no alias is defined
const returnCols = `id::text, business_id::text, branch_id::text, name, category, sku, price, cost, stock_qty, unit, active, created_at::text`

func (h *ProductHandler) List(c *gin.Context) {
	businessID := c.GetString("business_id")
	activeOnly := c.Query("active") != "false"
	rows, err := h.DB.Query(c.Request.Context(),
		`SELECT `+productCols+` FROM products p
		 WHERE p.business_id = $1 AND p.active = $2
		 ORDER BY p.category NULLS LAST, p.name`,
		businessID, activeOnly)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	products := []model.Product{}
	for rows.Next() {
		var p model.Product
		if err := rows.Scan(&p.ID, &p.BusinessID, &p.BranchID, &p.Name, &p.Category, &p.SKU,
			&p.Price, &p.Cost, &p.StockQty, &p.Unit, &p.Active, &p.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		products = append(products, p)
	}
	c.JSON(http.StatusOK, products)
}

func (h *ProductHandler) Create(c *gin.Context) {
	businessID := c.GetString("business_id")
	branchID := c.GetString("branch_id")
	var body struct {
		Name     string   `json:"name" binding:"required"`
		Category *string  `json:"category"`
		SKU      *string  `json:"sku"`
		Price    float64  `json:"price"`
		Cost     *float64 `json:"cost"`
		StockQty int      `json:"stock_qty"`
		Unit     string   `json:"unit"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.Unit == "" {
		body.Unit = "each"
	}

	var p model.Product
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO products (business_id, branch_id, name, category, sku, price, cost, stock_qty, unit)
		VALUES ($1, NULLIF($2,'')::uuid, $3, $4, $5, $6, $7, $8, $9)
		RETURNING `+returnCols,
		businessID, branchID, body.Name, body.Category, body.SKU,
		body.Price, body.Cost, body.StockQty, body.Unit,
	).Scan(&p.ID, &p.BusinessID, &p.BranchID, &p.Name, &p.Category, &p.SKU,
		&p.Price, &p.Cost, &p.StockQty, &p.Unit, &p.Active, &p.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, p)
}

func (h *ProductHandler) Update(c *gin.Context) {
	businessID := c.GetString("business_id")
	var body struct {
		Name     *string  `json:"name"`
		Category *string  `json:"category"`
		SKU      *string  `json:"sku"`
		Price    *float64 `json:"price"`
		Cost     *float64 `json:"cost"`
		StockQty *int     `json:"stock_qty"`
		Unit     *string  `json:"unit"`
		Active   *bool    `json:"active"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var p model.Product
	err := h.DB.QueryRow(c.Request.Context(), `
		UPDATE products SET
			name      = COALESCE($3, name),
			category  = COALESCE($4, category),
			sku       = COALESCE($5, sku),
			price     = COALESCE($6, price),
			cost      = COALESCE($7, cost),
			stock_qty = COALESCE($8, stock_qty),
			unit      = COALESCE($9, unit),
			active    = COALESCE($10, active)
		WHERE id = $1 AND business_id = $2
		RETURNING `+returnCols,
		c.Param("id"), businessID,
		body.Name, body.Category, body.SKU, body.Price, body.Cost, body.StockQty, body.Unit, body.Active,
	).Scan(&p.ID, &p.BusinessID, &p.BranchID, &p.Name, &p.Category, &p.SKU,
		&p.Price, &p.Cost, &p.StockQty, &p.Unit, &p.Active, &p.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *ProductHandler) Delete(c *gin.Context) {
	businessID := c.GetString("business_id")
	tag, err := h.DB.Exec(c.Request.Context(),
		`DELETE FROM products WHERE id = $1 AND business_id = $2`,
		c.Param("id"), businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
