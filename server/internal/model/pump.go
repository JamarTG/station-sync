package model

type Pump struct {
	ID          string `db:"id"`
	Name        string `db:"name"`
	Description string `db:"description"`
}