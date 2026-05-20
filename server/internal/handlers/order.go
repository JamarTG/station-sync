package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-sync/internal/model"
)

type OrderHandler struct {
	DB *pgxpool.Pool
}

const orderCols = `o.id::text, o.business_id::text, o.branch_id::text, o.shift_id::text, o.cashier_id::text, o.cashier_name, o.customer_name, o.order_no, o.status, o.payment_method, o.subtotal, o.discount, o.tax, o.total, o.change_given, o.note, o.created_at::text`
const orderItemCols = `i.id::text, i.order_id::text, i.product_id::text, i.name, i.sku, i.quantity, i.unit_price, i.discount, i.total, i.created_at::text`

func scanOrder(row interface {
	Scan(...any) error
}, o *model.Order) error {
	return row.Scan(
		&o.ID, &o.BusinessID, &o.BranchID, &o.ShiftID, &o.CashierID, &o.CashierName,
		&o.CustomerName, &o.OrderNo, &o.Status, &o.PaymentMethod,
		&o.Subtotal, &o.Discount, &o.Tax, &o.Total, &o.ChangeGiven, &o.Note, &o.CreatedAt,
	)
}

func scanOrderItem(row interface {
	Scan(...any) error
}, i *model.OrderItem) error {
	return row.Scan(
		&i.ID, &i.OrderID, &i.ProductID, &i.Name, &i.SKU,
		&i.Quantity, &i.UnitPrice, &i.Discount, &i.Total, &i.CreatedAt,
	)
}

// ListByShift returns all orders for a convenience store shift.
func (h *OrderHandler) ListByShift(c *gin.Context) {
	businessID := c.GetString("business_id")
	shiftID := c.Param("shiftId")

	rows, err := h.DB.Query(c.Request.Context(),
		`SELECT `+orderCols+` FROM orders o
		 WHERE o.business_id = $1 AND o.shift_id = $2
		 ORDER BY o.order_no ASC`,
		businessID, shiftID)
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

// Create opens a new order for a shift, optionally with line items.
func (h *OrderHandler) Create(c *gin.Context) {
	businessID := c.GetString("business_id")
	branchID := c.GetString("branch_id")
	shiftID := c.Param("shiftId")

	var body struct {
		CashierID     *string `json:"cashier_id"`
		CashierName   string  `json:"cashier_name"`
		CustomerName  *string `json:"customer_name"`
		PaymentMethod *string `json:"payment_method"`
		Subtotal      float64 `json:"subtotal"`
		Discount      float64 `json:"discount"`
		Tax           float64 `json:"tax"`
		Total         float64 `json:"total"`
		ChangeGiven   *float64 `json:"change_given"`
		Note          *string `json:"note"`
		Status        string  `json:"status"`
		Items         []struct {
			ProductID *string `json:"product_id"`
			Name      string  `json:"name"`
			SKU       *string `json:"sku"`
			Quantity  int     `json:"quantity"`
			UnitPrice float64 `json:"unit_price"`
			Discount  float64 `json:"discount"`
			Total     float64 `json:"total"`
		} `json:"items"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.Status == "" {
		body.Status = "open"
	}

	tx, err := h.DB.Begin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer tx.Rollback(c.Request.Context())

	var o model.Order
	err = scanOrder(
		tx.QueryRow(c.Request.Context(), `
			INSERT INTO orders
			  (business_id, branch_id, shift_id, cashier_id, cashier_name, customer_name,
			   payment_method, subtotal, discount, tax, total, change_given, note, status)
			VALUES ($1, NULLIF($2,'')::uuid, NULLIF($3,'')::uuid, $4, $5, $6,
			        $7, $8, $9, $10, $11, $12, $13, $14)
			RETURNING `+orderCols,
			businessID, branchID, shiftID, body.CashierID, body.CashierName, body.CustomerName,
			body.PaymentMethod, body.Subtotal, body.Discount, body.Tax, body.Total,
			body.ChangeGiven, body.Note, body.Status,
		), &o)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	for _, it := range body.Items {
		var item model.OrderItem
		err = scanOrderItem(
			tx.QueryRow(c.Request.Context(), `
				INSERT INTO order_items (order_id, product_id, name, sku, quantity, unit_price, discount, total)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
				RETURNING `+orderItemCols,
				o.ID, it.ProductID, it.Name, it.SKU, it.Quantity, it.UnitPrice, it.Discount, it.Total,
			), &item)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		o.Items = append(o.Items, item)
	}

	if err := tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, o)
}

// UpdateStatus voids or marks an order as paid.
func (h *OrderHandler) UpdateStatus(c *gin.Context) {
	businessID := c.GetString("business_id")
	var body struct {
		Status        string   `json:"status" binding:"required"`
		PaymentMethod *string  `json:"payment_method"`
		ChangeGiven   *float64 `json:"change_given"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var o model.Order
	err := scanOrder(
		h.DB.QueryRow(c.Request.Context(), `
			UPDATE orders SET
				status         = $3,
				payment_method = COALESCE($4, payment_method),
				change_given   = COALESCE($5, change_given)
			WHERE id = $1 AND business_id = $2
			RETURNING `+orderCols,
			c.Param("orderId"), businessID, body.Status, body.PaymentMethod, body.ChangeGiven,
		), &o)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, o)
}
