package model

type Branch struct {
	ID         string `db:"id" json:"id"`
	BusinessID string `db:"business_id" json:"business_id"`
	Name       string `db:"name" json:"name"`
	CreatedAt  string `db:"created_at" json:"created_at"`
}
