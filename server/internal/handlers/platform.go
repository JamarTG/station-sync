package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PlatformHandler struct {
	DB *pgxpool.Pool
}

type AccountSummary struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	UserCount  int    `json:"user_count"`
	BranchCount int   `json:"branch_count"`
	CreatedAt  string `json:"created_at"`
}

func (h *PlatformHandler) ListAccounts(c *gin.Context) {
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT
			b.id::text,
			b.name,
			COUNT(DISTINCT u.id) FILTER (WHERE u.id IS NOT NULL) AS user_count,
			COUNT(DISTINCT br.id) FILTER (WHERE br.id IS NOT NULL) AS branch_count,
			b.created_at::text
		FROM businesses b
		LEFT JOIN users u ON u.business_id = b.id AND u.active = true
		LEFT JOIN branches br ON br.business_id = b.id
		GROUP BY b.id, b.name, b.created_at
		ORDER BY b.created_at DESC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	accounts := []AccountSummary{}
	for rows.Next() {
		var a AccountSummary
		if err := rows.Scan(&a.ID, &a.Name, &a.UserCount, &a.BranchCount, &a.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		accounts = append(accounts, a)
	}
	c.JSON(http.StatusOK, accounts)
}
