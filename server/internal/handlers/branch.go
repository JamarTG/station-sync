package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

type BranchHandler struct {
	DB *pgxpool.Pool
}

func (h *BranchHandler) List(c *gin.Context) {
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(),
		`SELECT id::text, business_id::text, name, created_at::text
		 FROM branches WHERE business_id = $1 ORDER BY name`,
		businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	branches := []model.Branch{}
	for rows.Next() {
		var b model.Branch
		if err := rows.Scan(&b.ID, &b.BusinessID, &b.Name, &b.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		branches = append(branches, b)
	}
	c.JSON(http.StatusOK, branches)
}

func (h *BranchHandler) Create(c *gin.Context) {
	businessID := c.GetString("business_id")
	var body struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var b model.Branch
	err := h.DB.QueryRow(c.Request.Context(),
		`INSERT INTO branches (business_id, name) VALUES ($1, $2)
		 RETURNING id::text, business_id::text, name, created_at::text`,
		businessID, body.Name,
	).Scan(&b.ID, &b.BusinessID, &b.Name, &b.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, b)
}
