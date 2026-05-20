package model

type Product struct {
	ID         string   `db:"id"          json:"id"`
	BusinessID string   `db:"business_id" json:"business_id"`
	BranchID   *string  `db:"branch_id"   json:"branch_id"`
	Name       string   `db:"name"        json:"name"`
	Category   *string  `db:"category"    json:"category"`
	SKU        *string  `db:"sku"         json:"sku"`
	Price      float64  `db:"price"       json:"price"`
	Cost       *float64 `db:"cost"        json:"cost"`
	StockQty   int      `db:"stock_qty"   json:"stock_qty"`
	Unit       string   `db:"unit"        json:"unit"`
	Active     bool     `db:"active"      json:"active"`
	CreatedAt  string   `db:"created_at"  json:"created_at"`
}
