package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RequireAuth(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		token := strings.TrimPrefix(auth, "Bearer ")
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		var userID, role, userName string
		var businessID, branchID *string
		err := db.QueryRow(c.Request.Context(), `
			SELECT s.user_id::text, s.business_id::text, u.role, s.branch_id::text, u.name
			FROM sessions s
			JOIN users u ON u.id = s.user_id
			WHERE s.token = $1 AND s.expires_at > NOW() AND u.active = true`,
			token,
		).Scan(&userID, &businessID, &role, &branchID, &userName)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		c.Set("user_id", userID)
		c.Set("user_name", userName)
		c.Set("role", role)
		if businessID != nil {
			c.Set("business_id", *businessID)
		} else {
			c.Set("business_id", "")
		}
		if branchID != nil {
			c.Set("branch_id", *branchID)
		} else {
			c.Set("branch_id", "")
		}
		c.Next()
	}
}

func RequirePlatformAdmin(c *gin.Context) {
	if c.GetString("role") != "Super Duper Admin" {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	c.Next()
}
