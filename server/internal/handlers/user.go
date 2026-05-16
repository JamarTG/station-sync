package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"project-sync/internal/model"
)

type UserHandler struct {
	DB *pgxpool.Pool
}

const userSelectCols = `id::text, business_id::text, branch_id::text, name, role, email, active,
	COALESCE(phone,''), COALESCE(nis,''), COALESCE(trn,''),
	employed_on::text, date_of_birth::text, must_change_password`

func scanUser(row interface {
	Scan(...any) error
}, u *model.User) error {
	return row.Scan(&u.ID, &u.BusinessID, &u.BranchID, &u.Name, &u.Role, &u.Email, &u.Active,
		&u.Phone, &u.NIS, &u.TRN, &u.EmployedOn, &u.DateOfBirth, &u.MustChangePassword)
}

func (h *UserHandler) List(c *gin.Context) {
	businessID := c.GetString("business_id")
	branchID := c.GetString("branch_id")
	rows, err := h.DB.Query(c.Request.Context(),
		`SELECT `+userSelectCols+` FROM users
		 WHERE business_id = $1 AND ($2 = '' OR branch_id::text = $2)
		 ORDER BY name`,
		businessID, branchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	users := []model.User{}
	for rows.Next() {
		var u model.User
		if err := scanUser(rows, &u); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		users = append(users, u)
	}
	c.JSON(http.StatusOK, users)
}

func (h *UserHandler) Get(c *gin.Context) {
	businessID := c.GetString("business_id")
	var u model.User
	err := scanUser(
		h.DB.QueryRow(c.Request.Context(),
			`SELECT `+userSelectCols+` FROM users WHERE id = $1 AND business_id = $2`,
			c.Param("id"), businessID),
		&u,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, u)
}

func (h *UserHandler) Create(c *gin.Context) {
	businessID := c.GetString("business_id")
	branchID := c.GetString("branch_id")
	var body struct {
		Name        string `json:"name" binding:"required"`
		Role        string `json:"role" binding:"required"`
		Password    string `json:"password" binding:"required"`
		Phone       string `json:"phone"`
		NIS         string `json:"nis"`
		TRN         string `json:"trn"`
		Email       string `json:"email" binding:"required"`
		EmployedOn  string `json:"employed_on"`
		DateOfBirth string `json:"date_of_birth"`
		BranchID    string `json:"branch_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.BranchID != "" {
		branchID = body.BranchID
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var u model.User
	err = scanUser(
		h.DB.QueryRow(c.Request.Context(), `
			INSERT INTO users (business_id, branch_id, name, role, password_hash, phone, nis, trn, email,
			                   employed_on, date_of_birth, must_change_password)
			VALUES ($1, NULLIF($2,'')::uuid, $3, $4, $5, $6, $7, $8, $9,
			        NULLIF($10,'')::date, NULLIF($11,'')::date, true)
			RETURNING `+userSelectCols,
			businessID, branchID, body.Name, body.Role, string(hash),
			body.Phone, body.NIS, body.TRN, body.Email,
			body.EmployedOn, body.DateOfBirth,
		),
		&u,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, u)
}

func (h *UserHandler) ChangePassword(c *gin.Context) {
	userID := c.GetString("user_id")
	var body struct {
		CurrentPassword string `json:"current_password" binding:"required"`
		NewPassword     string `json:"new_password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var hash string
	if err := h.DB.QueryRow(c.Request.Context(),
		`SELECT password_hash FROM users WHERE id = $1`, userID,
	).Scan(&hash); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(body.CurrentPassword)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "current password is incorrect"})
		return
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(body.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if _, err := h.DB.Exec(c.Request.Context(),
		`UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2`,
		string(newHash), userID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *UserHandler) Update(c *gin.Context) {
	businessID := c.GetString("business_id")
	var body struct {
		Name        *string `json:"name"`
		Role        *string `json:"role"`
		Email       *string `json:"email"`
		Phone       *string `json:"phone"`
		NIS         *string `json:"nis"`
		TRN         *string `json:"trn"`
		EmployedOn  *string `json:"employed_on"`
		DateOfBirth *string `json:"date_of_birth"`
		Active      *bool   `json:"active"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var u model.User
	err := scanUser(
		h.DB.QueryRow(c.Request.Context(), `
			UPDATE users SET
				name         = COALESCE($3, name),
				role         = COALESCE($4, role),
				email        = COALESCE($5, email),
				phone        = COALESCE($6, phone),
				nis          = COALESCE($7, nis),
				trn          = COALESCE($8, trn),
				employed_on  = COALESCE(NULLIF($9,'')::date, employed_on),
				date_of_birth = COALESCE(NULLIF($10,'')::date, date_of_birth),
				active       = COALESCE($11, active)
			WHERE id = $1 AND business_id = $2
			RETURNING `+userSelectCols,
			c.Param("id"), businessID,
			body.Name, body.Role, body.Email, body.Phone, body.NIS, body.TRN,
			func() string { if body.EmployedOn != nil { return *body.EmployedOn }; return "" }(),
			func() string { if body.DateOfBirth != nil { return *body.DateOfBirth }; return "" }(),
			body.Active,
		),
		&u,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, u)
}
