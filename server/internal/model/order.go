package model

type Order struct {
	ID            string      `db:"id"             json:"id"`
	BusinessID    string      `db:"business_id"    json:"business_id"`
	BranchID      *string     `db:"branch_id"      json:"branch_id"`
	ShiftID       *string     `db:"shift_id"       json:"shift_id"`
	CashierID     *string     `db:"cashier_id"     json:"cashier_id"`
	CashierName   string      `db:"cashier_name"   json:"cashier_name"`
	CustomerName  *string     `db:"customer_name"  json:"customer_name"`
	OrderNo       int64       `db:"order_no"       json:"order_no"`
	Status        string      `db:"status"         json:"status"`
	PaymentMethod *string     `db:"payment_method" json:"payment_method"`
	Subtotal      float64     `db:"subtotal"       json:"subtotal"`
	Discount      float64     `db:"discount"       json:"discount"`
	Tax           float64     `db:"tax"            json:"tax"`
	Total         float64     `db:"total"          json:"total"`
	ChangeGiven   *float64    `db:"change_given"   json:"change_given"`
	Note          *string     `db:"note"           json:"note"`
	CreatedAt     string      `db:"created_at"     json:"created_at"`
	Items         []OrderItem `db:"-"              json:"items,omitempty"`
}

type OrderItem struct {
	ID        string  `db:"id"         json:"id"`
	OrderID   string  `db:"order_id"   json:"order_id"`
	ProductID *string `db:"product_id" json:"product_id"`
	Name      string  `db:"name"       json:"name"`
	SKU       *string `db:"sku"        json:"sku"`
	Quantity  int     `db:"quantity"   json:"quantity"`
	UnitPrice float64 `db:"unit_price" json:"unit_price"`
	Discount  float64 `db:"discount"   json:"discount"`
	Total     float64 `db:"total"      json:"total"`
	CreatedAt string  `db:"created_at" json:"created_at"`
}
