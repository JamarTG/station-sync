package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type IssueHandler struct {
	DB *pgxpool.Pool
}

type Issue struct {
	ID           string    `json:"id"`
	BusinessID   string    `json:"business_id"`
	BranchID     *string   `json:"branch_id"`
	ReporterID   *string   `json:"reporter_id"`
	ReporterName string    `json:"reporter_name"`
	Category     string    `json:"category"`
	Description  string    `json:"description"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"created_at"`
}

func (h *IssueHandler) Create(c *gin.Context) {
	businessID := c.GetString("business_id")
	branchID := c.GetString("branch_id")
	userID := c.GetString("user_id")
	userName := c.GetString("user_name")

	var body struct {
		Category    string `json:"category" binding:"required"`
		Description string `json:"description" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var branchIDPtr *string
	if branchID != "" {
		branchIDPtr = &branchID
	}
	var reporterIDPtr *string
	if userID != "" {
		reporterIDPtr = &userID
	}

	var issue Issue
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO issues (business_id, branch_id, reporter_id, reporter_name, category, description)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id::text, business_id::text, branch_id::text, reporter_id::text,
		          reporter_name, category, description, status, created_at`,
		businessID, branchIDPtr, reporterIDPtr, userName, body.Category, body.Description,
	).Scan(&issue.ID, &issue.BusinessID, &issue.BranchID, &issue.ReporterID,
		&issue.ReporterName, &issue.Category, &issue.Description, &issue.Status, &issue.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, issue)
}

func (h *IssueHandler) List(c *gin.Context) {
	businessID := c.GetString("business_id")

	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT id::text, business_id::text, branch_id::text, reporter_id::text,
		       reporter_name, category, description, status, created_at
		FROM issues
		WHERE business_id = $1
		ORDER BY created_at DESC`,
		businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	issues := []Issue{}
	for rows.Next() {
		var i Issue
		if err := rows.Scan(&i.ID, &i.BusinessID, &i.BranchID, &i.ReporterID,
			&i.ReporterName, &i.Category, &i.Description, &i.Status, &i.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		issues = append(issues, i)
	}
	c.JSON(http.StatusOK, issues)
}

func (h *IssueHandler) UpdateStatus(c *gin.Context) {
	businessID := c.GetString("business_id")

	var body struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var issue Issue
	err := h.DB.QueryRow(c.Request.Context(), `
		UPDATE issues SET status = $1
		WHERE id = $2 AND business_id = $3
		RETURNING id::text, business_id::text, branch_id::text, reporter_id::text,
		          reporter_name, category, description, status, created_at`,
		body.Status, c.Param("id"), businessID,
	).Scan(&issue.ID, &issue.BusinessID, &issue.BranchID, &issue.ReporterID,
		&issue.ReporterName, &issue.Category, &issue.Description, &issue.Status, &issue.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, issue)
}
