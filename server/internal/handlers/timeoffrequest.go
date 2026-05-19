package handlers

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

type TimeOffRequestHandler struct {
	DB *pgxpool.Pool
}

var approverRoles = map[string]bool{
	"Super Admin": true,
	"Admin":       true,
	"Manager":     true,
}

var requesterRoles = map[string]bool{
	"Supervisor": true,
	"Attendant":  true,
}

func (h *TimeOffRequestHandler) List(c *gin.Context) {
	businessID := c.GetString("business_id")
	userID := c.GetString("user_id")
	role := c.GetString("role")

	var rows interface{ Close() }
	var err error

	if approverRoles[role] {
		r, e := h.DB.Query(c.Request.Context(), `
			SELECT id::text, business_id::text, user_id::text, user_name, date::text,
			       reason, status, reviewed_by::text, reviewed_by_name, reviewed_at::text, created_at::text
			FROM time_off_requests
			WHERE business_id = $1
			ORDER BY created_at DESC`, businessID)
		rows, err = r, e
	} else {
		r, e := h.DB.Query(c.Request.Context(), `
			SELECT id::text, business_id::text, user_id::text, user_name, date::text,
			       reason, status, reviewed_by::text, reviewed_by_name, reviewed_at::text, created_at::text
			FROM time_off_requests
			WHERE business_id = $1 AND user_id = $2
			ORDER BY created_at DESC`, businessID, userID)
		rows, err = r, e
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	type pgRows interface {
		Next() bool
		Scan(...any) error
		Close()
	}
	pgr := rows.(pgRows)
	defer pgr.Close()

	result := []model.TimeOffRequest{}
	for pgr.Next() {
		var r model.TimeOffRequest
		if err := pgr.Scan(&r.ID, &r.BusinessID, &r.UserID, &r.UserName, &r.Date,
			&r.Reason, &r.Status, &r.ReviewedBy, &r.ReviewedByName, &r.ReviewedAt, &r.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		result = append(result, r)
	}
	c.JSON(http.StatusOK, result)
}

func (h *TimeOffRequestHandler) Create(c *gin.Context) {
	businessID := c.GetString("business_id")
	userID := c.GetString("user_id")
	role := c.GetString("role")

	if !requesterRoles[role] && !approverRoles[role] {
		c.JSON(http.StatusForbidden, gin.H{"error": "not allowed"})
		return
	}

	var body struct {
		Date   string  `json:"date" binding:"required"`
		Reason *string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	today := time.Now().Format("2006-01-02")
	if body.Date < today {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot request a past date"})
		return
	}

	var recentExists bool
	if err := h.DB.QueryRow(c.Request.Context(),
		`SELECT EXISTS(SELECT 1 FROM time_off_requests WHERE user_id = $1 AND created_at > NOW() - INTERVAL '3 hours')`,
		userID,
	).Scan(&recentExists); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if recentExists {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "you already submitted a request recently — please wait a few hours before submitting another"})
		return
	}

	var r model.TimeOffRequest
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO time_off_requests (business_id, user_id, user_name, date, reason)
		VALUES ($1, $2, (SELECT name FROM users WHERE id = $2), $3, $4)
		RETURNING id::text, business_id::text, user_id::text, user_name, date::text,
		          reason, status, reviewed_by::text, reviewed_by_name, reviewed_at::text, created_at::text`,
		businessID, userID, body.Date, body.Reason,
	).Scan(&r.ID, &r.BusinessID, &r.UserID, &r.UserName, &r.Date,
		&r.Reason, &r.Status, &r.ReviewedBy, &r.ReviewedByName, &r.ReviewedAt, &r.CreatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			c.JSON(http.StatusConflict, gin.H{"error": "you already have a request for this date"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, r)
}

func (h *TimeOffRequestHandler) Review(c *gin.Context) {
	role := c.GetString("role")
	if !approverRoles[role] {
		c.JSON(http.StatusForbidden, gin.H{"error": "not allowed"})
		return
	}

	businessID := c.GetString("business_id")
	reviewerID := c.GetString("user_id")
	action := c.Param("action") // "approve" or "reject"

	status := "Approved"
	if action == "reject" {
		status = "Rejected"
	}

	var r model.TimeOffRequest
	err := h.DB.QueryRow(c.Request.Context(), `
		UPDATE time_off_requests
		SET status = $1,
		    reviewed_by = $2,
		    reviewed_by_name = (SELECT name FROM users WHERE id = $2),
		    reviewed_at = NOW()
		WHERE id = $3 AND business_id = $4 AND status = 'Pending'
		RETURNING id::text, business_id::text, user_id::text, user_name, date::text,
		          reason, status, reviewed_by::text, reviewed_by_name, reviewed_at::text, created_at::text`,
		status, reviewerID, c.Param("id"), businessID,
	).Scan(&r.ID, &r.BusinessID, &r.UserID, &r.UserName, &r.Date,
		&r.Reason, &r.Status, &r.ReviewedBy, &r.ReviewedByName, &r.ReviewedAt, &r.CreatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "request not found or already reviewed"})
		return
	}
	c.JSON(http.StatusOK, r)
}
