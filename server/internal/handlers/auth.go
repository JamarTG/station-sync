package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"project-sync/internal/model"
)

type AuthHandler struct {
	DB *pgxpool.Pool
}

type authResponse struct {
	Token string     `json:"token"`
	User  model.User `json:"user"`
}

func generateToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func (h *AuthHandler) Login(c *gin.Context) {
	var body struct {
		Email    string `json:"email" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var u model.User
	var passwordHash string
	err := h.DB.QueryRow(c.Request.Context(), `
		SELECT u.id::text, u.business_id::text, u.branch_id::text, u.name, u.role, u.email, u.active,
		       COALESCE(u.phone,''), COALESCE(u.nis,''), COALESCE(u.trn,''),
		       u.employed_on::text, u.date_of_birth::text, u.must_change_password, u.password_hash,
		       COALESCE(b.name,''), COALESCE(b.address_line1,''), COALESCE(b.address_line2,''),
		       COALESCE(b.city,''), COALESCE(b.parish,'')
		FROM users u
		LEFT JOIN businesses b ON b.id = u.business_id
		WHERE u.email = $1 AND u.active = true`,
		body.Email,
	).Scan(&u.ID, &u.BusinessID, &u.BranchID, &u.Name, &u.Role, &u.Email, &u.Active,
		&u.Phone, &u.NIS, &u.TRN, &u.EmployedOn, &u.DateOfBirth, &u.MustChangePassword, &passwordHash,
		&u.BusinessName, &u.BusinessAddressLine1, &u.BusinessAddressLine2, &u.BusinessCity, &u.BusinessParish)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(body.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	token := generateToken()
	if _, err := h.DB.Exec(c.Request.Context(),
		`INSERT INTO sessions (token, user_id, business_id, branch_id) VALUES ($1, $2, $3, $4)`,
		token, u.ID, u.BusinessID, u.BranchID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, authResponse{Token: token, User: u})
}

func (h *AuthHandler) SignUp(c *gin.Context) {
	var body struct {
		BusinessName        string `json:"business_name" binding:"required"`
		BranchName          string `json:"branch_name"`
		Name                string `json:"name" binding:"required"`
		Email               string `json:"email" binding:"required"`
		Password            string `json:"password" binding:"required"`
		BusinessAddressLine1 string `json:"address_line1"`
		BusinessAddressLine2 string `json:"address_line2"`
		BusinessCity        string `json:"city"`
		BusinessParish      string `json:"parish"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	branchName := body.BranchName
	if branchName == "" {
		branchName = body.BusinessName
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var businessID string
	if err := h.DB.QueryRow(c.Request.Context(),
		`INSERT INTO businesses (name) VALUES ($1) RETURNING id::text`,
		body.BusinessName,
	).Scan(&businessID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Save address fields — silently ignored if migration 009 hasn't been applied yet
	h.DB.Exec(c.Request.Context(),
		`UPDATE businesses SET address_line1=$2, address_line2=$3, city=$4, parish=$5 WHERE id=$1`,
		businessID, body.BusinessAddressLine1, body.BusinessAddressLine2, body.BusinessCity, body.BusinessParish,
	)

	var branchID string
	if err := h.DB.QueryRow(c.Request.Context(),
		`INSERT INTO branches (business_id, name) VALUES ($1, $2) RETURNING id::text`,
		businessID, branchName,
	).Scan(&branchID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var u model.User
	err = h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO users (business_id, name, email, role, password_hash)
		VALUES ($1, $2, $3, 'Super Admin', $4)
		RETURNING id::text, business_id::text, branch_id::text, name, role, email, active,
		          COALESCE(phone,''), COALESCE(nis,''), COALESCE(trn,''),
		          employed_on::text, date_of_birth::text, must_change_password`,
		businessID, body.Name, body.Email, string(hash),
	).Scan(&u.ID, &u.BusinessID, &u.BranchID, &u.Name, &u.Role, &u.Email, &u.Active,
		&u.Phone, &u.NIS, &u.TRN, &u.EmployedOn, &u.DateOfBirth, &u.MustChangePassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	token := generateToken()
	if _, err := h.DB.Exec(c.Request.Context(),
		`INSERT INTO sessions (token, user_id, business_id, branch_id) VALUES ($1, $2, $3, $4)`,
		token, u.ID, businessID, branchID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	u.BusinessName = body.BusinessName
	u.BusinessAddressLine1 = body.BusinessAddressLine1
	u.BusinessAddressLine2 = body.BusinessAddressLine2
	u.BusinessCity = body.BusinessCity
	u.BusinessParish = body.BusinessParish
	c.JSON(http.StatusCreated, authResponse{Token: token, User: u})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	auth := c.GetHeader("Authorization")
	token := auth
	if len(auth) > 7 && auth[:7] == "Bearer " {
		token = auth[7:]
	}
	h.DB.Exec(c.Request.Context(), `DELETE FROM sessions WHERE token = $1`, token)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
