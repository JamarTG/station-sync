package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"project-sync/internal/model"
)

type UserHandler struct {
	DB *pgxpool.Pool
}

const userSelectCols = `id::text, name, role, active, employed_on, date_of_birth, phone, nis, trn, email, pay_rate, pay_type`

func scanUser(row pgx.Row, u *model.User) error {
	return row.Scan(&u.ID, &u.Name, &u.Role, &u.Active, &u.EmployedOn, &u.DateOfBirth, &u.Phone, &u.NIS, &u.TRN, &u.Email, &u.PayRate, &u.PayType)
}

func (h *UserHandler) List(c *gin.Context) {
	rows, err := h.DB.Query(c.Request.Context(),
		`SELECT `+userSelectCols+` FROM users ORDER BY name`)
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
	var u model.User
	err := scanUser(h.DB.QueryRow(c.Request.Context(),
		`SELECT `+userSelectCols+` FROM users WHERE id = $1`, c.Param("id")), &u)
	if err == pgx.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, u)
}

func (h *UserHandler) UpdatePay(c *gin.Context) {
	var body struct {
		PayRate *float64 `json:"pay_rate"`
		PayType *string  `json:"pay_type"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var u model.User
	err := scanUser(h.DB.QueryRow(c.Request.Context(), `
		UPDATE users SET pay_rate = $1, pay_type = $2
		WHERE id = $3
		RETURNING `+userSelectCols,
		body.PayRate, body.PayType, c.Param("id"),
	), &u)
	if err == pgx.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, u)
}

func (h *UserHandler) Create(c *gin.Context) {
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
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var u model.User
	err = scanUser(h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO users (name, role, password_hash, phone, nis, trn, email, employed_on, date_of_birth)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, '')::date, NULLIF($9, '')::date)
		RETURNING `+userSelectCols,
		body.Name, body.Role, string(hash), body.Phone, body.NIS, body.TRN, body.Email, body.EmployedOn, body.DateOfBirth,
	), &u)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, u)
}
