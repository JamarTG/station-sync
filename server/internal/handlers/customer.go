package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

type CustomerHandler struct {
	DB *pgxpool.Pool
}

const customerCols = `id::text, business_id::text, user_id::text, name, COALESCE(phone,''), COALESCE(email,''), credit_balance, status, created_at::text`

func scanCustomer(row interface {
	Scan(...any) error
}, cu *model.Customer) error {
	return row.Scan(&cu.ID, &cu.BusinessID, &cu.UserID, &cu.Name, &cu.Phone, &cu.Email,
		&cu.CreditBalance, &cu.Status, &cu.CreatedAt)
}

// List returns all customer accounts for the business.
func (h *CustomerHandler) List(c *gin.Context) {
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(),
		`SELECT `+customerCols+` FROM customers WHERE business_id = $1 ORDER BY name`,
		businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	customers := []model.Customer{}
	for rows.Next() {
		var cu model.Customer
		if err := scanCustomer(rows, &cu); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		customers = append(customers, cu)
	}
	c.JSON(http.StatusOK, customers)
}

// Create adds a standalone customer account (not tied to a staff member).
func (h *CustomerHandler) Create(c *gin.Context) {
	businessID := c.GetString("business_id")
	var body struct {
		Name  string `json:"name" binding:"required"`
		Phone string `json:"phone"`
		Email string `json:"email"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var cu model.Customer
	err := scanCustomer(
		h.DB.QueryRow(c.Request.Context(), `
			INSERT INTO customers (business_id, name, phone, email)
			VALUES ($1, $2, NULLIF($3,''), NULLIF($4,''))
			RETURNING `+customerCols,
			businessID, body.Name, body.Phone, body.Email,
		), &cu)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, cu)
}

// ListOrders returns a customer's purchase history (orders placed under their name).
func (h *CustomerHandler) ListOrders(c *gin.Context) {
	businessID := c.GetString("business_id")
	ctx := c.Request.Context()

	var name string
	if err := h.DB.QueryRow(ctx,
		`SELECT name FROM customers WHERE id = $1 AND business_id = $2`,
		c.Param("id"), businessID).Scan(&name); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "customer not found"})
		return
	}

	rows, err := h.DB.Query(ctx,
		`SELECT `+orderCols+` FROM orders o
		 WHERE o.business_id = $1 AND o.customer_name = $2
		 ORDER BY o.created_at DESC`,
		businessID, name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	orders := []model.Order{}
	for rows.Next() {
		var o model.Order
		if err := scanOrder(rows, &o); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		orders = append(orders, o)
	}
	c.JSON(http.StatusOK, orders)
}

// Update edits a customer's contact details or status.
func (h *CustomerHandler) Update(c *gin.Context) {
	businessID := c.GetString("business_id")
	var body struct {
		Name   *string `json:"name"`
		Phone  *string `json:"phone"`
		Email  *string `json:"email"`
		Status *string `json:"status"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var cu model.Customer
	err := scanCustomer(
		h.DB.QueryRow(c.Request.Context(), `
			UPDATE customers SET
				name   = COALESCE($3, name),
				phone  = COALESCE($4, phone),
				email  = COALESCE($5, email),
				status = COALESCE($6, status)
			WHERE id = $1 AND business_id = $2
			RETURNING `+customerCols,
			c.Param("id"), businessID, body.Name, body.Phone, body.Email, body.Status,
		), &cu)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, cu)
}
