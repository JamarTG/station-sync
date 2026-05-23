package model

type Customer struct {
	ID            string  `db:"id"             json:"id"`
	BusinessID    string  `db:"business_id"    json:"business_id"`
	UserID        *string `db:"user_id"        json:"user_id"`
	Name          string  `db:"name"           json:"name"`
	Phone         string  `db:"phone"          json:"phone"`
	Email         string  `db:"email"          json:"email"`
	CreditBalance float64 `db:"credit_balance" json:"credit_balance"`
	Status        string  `db:"status"         json:"status"`
	CreatedAt     string  `db:"created_at"     json:"created_at"`
}
