package model

type Business struct {
	ID        string `db:"id" json:"id"`
	Name      string `db:"name" json:"name"`
	CreatedAt string `db:"created_at" json:"created_at"`
}
