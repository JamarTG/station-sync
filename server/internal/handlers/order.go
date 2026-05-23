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

const orderCols = `o.id::text, o.business_id::text, o.branch_id::text, o.shift_id::text, o.cashier_id::text, o.cashier_name, o.customer_name, o.order_no, o.status, o.payment_method, o.subtotal, o.discount, o.tax, o.total, o.change_given, o.note, o.invoice_no, o.created_at::text`
const orderItemCols = `i.id::text, i.order_id::text, i.product_id::text, i.name, i.sku, i.quantity, i.unit_price, i.discount, i.total, i.refunded, i.created_at::text`

func scanOrder(row interface {
	Scan(...any) error
}, o *model.Order) error {
	return row.Scan(
		&o.ID, &o.BusinessID, &o.BranchID, &o.ShiftID, &o.CashierID, &o.CashierName,
		&o.CustomerName, &o.OrderNo, &o.Status, &o.PaymentMethod,
		&o.Subtotal, &o.Discount, &o.Tax, &o.Total, &o.ChangeGiven, &o.Note, &o.InvoiceNo, &o.CreatedAt,
	)
}

func scanOrderItem(row interface {
	Scan(...any) error
}, i *model.OrderItem) error {
	return row.Scan(
		&i.ID, &i.OrderID, &i.ProductID, &i.Name, &i.SKU,
		&i.Quantity, &i.UnitPrice, &i.Discount, &i.Total, &i.Refunded, &i.CreatedAt,
	)
}

// ListByShift returns all orders (with their line items) for a convenience store shift.
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
	orderIdx := map[string]int{} // id → slice index
	for rows.Next() {
		var o model.Order
		if err := scanOrder(rows, &o); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		orderIdx[o.ID] = len(orders)
		orders = append(orders, o)
	}
	rows.Close()

	// Fetch all line items for these orders in one query and attach them.
	if len(orders) > 0 {
		ids := make([]string, len(orders))
		for i, o := range orders {
			ids[i] = o.ID
		}
		itemRows, err := h.DB.Query(c.Request.Context(),
			`SELECT `+orderItemCols+` FROM order_items i
			 WHERE i.order_id = ANY($1::uuid[])
			 ORDER BY i.created_at ASC`,
			ids)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer itemRows.Close()
		for itemRows.Next() {
			var item model.OrderItem
			if err := scanOrderItem(itemRows, &item); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if idx, ok := orderIdx[item.OrderID]; ok {
				orders[idx].Items = append(orders[idx].Items, item)
			}
		}
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
		Note          *string  `json:"note"`
		InvoiceNo     *string  `json:"invoice_no"`
		Status        string   `json:"status"`
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
			INSERT INTO orders AS o
			  (business_id, branch_id, shift_id, cashier_id, cashier_name, customer_name,
			   payment_method, subtotal, discount, tax, total, change_given, note, status, invoice_no)
			VALUES ($1, NULLIF($2,'')::uuid, NULLIF($3,'')::uuid, $4, $5, $6,
			        $7, $8, $9, $10, $11, $12, $13, $14, $15)
			RETURNING `+orderCols,
			businessID, branchID, shiftID, body.CashierID, body.CashierName, body.CustomerName,
			body.PaymentMethod, body.Subtotal, body.Discount, body.Tax, body.Total,
			body.ChangeGiven, body.Note, body.Status, body.InvoiceNo,
		), &o)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	for _, it := range body.Items {
		var item model.OrderItem
		err = scanOrderItem(
			tx.QueryRow(c.Request.Context(), `
				INSERT INTO order_items AS i (order_id, product_id, name, sku, quantity, unit_price, discount, total)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
				RETURNING `+orderItemCols,
				o.ID, it.ProductID, it.Name, it.SKU, it.Quantity, it.UnitPrice, it.Discount, it.Total,
			), &item)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		o.Items = append(o.Items, item)

		// A fulfilled sale (paid or charged to credit) reduces product stock.
		if (o.Status == "paid" || o.Status == "credit") && it.ProductID != nil {
			if _, err = tx.Exec(c.Request.Context(),
				`UPDATE products SET stock_qty = stock_qty - $1
				 WHERE id = $2 AND business_id = $3`,
				it.Quantity, *it.ProductID, businessID); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}
	}

	// A credit sale is charged to the customer's account balance.
	if o.Status == "credit" && o.CustomerName != nil && *o.CustomerName != "" {
		tag, err := tx.Exec(c.Request.Context(),
			`UPDATE customers SET credit_balance = credit_balance + $1
			 WHERE business_id = $2 AND name = $3`,
			o.Total, businessID, *o.CustomerName)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if tag.RowsAffected() == 0 {
			// no existing customer with that name — create one for the balance
			if _, err = tx.Exec(c.Request.Context(),
				`INSERT INTO customers (business_id, name, credit_balance) VALUES ($1, $2, $3)`,
				businessID, *o.CustomerName, o.Total); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}
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
	orderID := c.Param("orderId")
	var body struct {
		Status        string   `json:"status" binding:"required"`
		PaymentMethod *string  `json:"payment_method"`
		ChangeGiven   *float64 `json:"change_given"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer tx.Rollback(ctx)

	// Capture the current status so we know whether stock needs restoring.
	var prevStatus string
	if err := tx.QueryRow(ctx,
		`SELECT status FROM orders WHERE id = $1 AND business_id = $2`,
		orderID, businessID).Scan(&prevStatus); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var o model.Order
	err = scanOrder(
		tx.QueryRow(ctx, `
			UPDATE orders AS o SET
				status         = $3,
				payment_method = COALESCE($4, o.payment_method),
				change_given   = COALESCE($5, o.change_given)
			WHERE o.id = $1 AND o.business_id = $2
			RETURNING `+orderCols,
			orderID, businessID, body.Status, body.PaymentMethod, body.ChangeGiven,
		), &o)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Voiding a fulfilled sale (paid or credit) returns its items to stock.
	if body.Status == "voided" && (prevStatus == "paid" || prevStatus == "credit") {
		if _, err := tx.Exec(ctx,
			`UPDATE products p SET stock_qty = stock_qty + i.quantity
			 FROM order_items i
			 WHERE i.order_id = $1 AND i.product_id = p.id`,
			orderID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	// Voiding a credit sale clears the amount owed from the customer's account.
	if body.Status == "voided" && prevStatus == "credit" && o.CustomerName != nil && *o.CustomerName != "" {
		if _, err := tx.Exec(ctx,
			`UPDATE customers SET credit_balance = credit_balance - $1
			 WHERE business_id = $2 AND name = $3`,
			o.Total, businessID, *o.CustomerName); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	// Settling a credit sale (credit → paid) clears the balance; stock already moved at sale time.
	if body.Status == "paid" && prevStatus == "credit" && o.CustomerName != nil && *o.CustomerName != "" {
		if _, err := tx.Exec(ctx,
			`UPDATE customers SET credit_balance = credit_balance - $1
			 WHERE business_id = $2 AND name = $3`,
			o.Total, businessID, *o.CustomerName); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, o)
}

// RefundItem marks a single order line item as refunded.
func (h *OrderHandler) RefundItem(c *gin.Context) {
	businessID := c.GetString("business_id")
	orderID := c.Param("orderId")
	itemID := c.Param("itemId")

	var body struct {
		Refunded *bool `json:"refunded"`
	}
	_ = c.ShouldBindJSON(&body)
	refunded := true
	if body.Refunded != nil {
		refunded = *body.Refunded
	}

	var item model.OrderItem
	err := scanOrderItem(
		h.DB.QueryRow(c.Request.Context(), `
			UPDATE order_items AS i SET refunded = $4
			WHERE i.id = $1 AND i.order_id = $2
			  AND EXISTS (SELECT 1 FROM orders o WHERE o.id = i.order_id AND o.business_id = $3)
			RETURNING `+orderItemCols,
			itemID, orderID, businessID, refunded,
		), &item)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

// Delete removes a held order (used when a held sale is resumed/unheld).
// Only held orders may be deleted — paid/voided orders are kept for the record.
func (h *OrderHandler) Delete(c *gin.Context) {
	businessID := c.GetString("business_id")
	tag, err := h.DB.Exec(c.Request.Context(),
		`DELETE FROM orders WHERE id = $1 AND business_id = $2 AND status = 'held'`,
		c.Param("orderId"), businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "held order not found"})
		return
	}
	c.Status(http.StatusNoContent)
}
