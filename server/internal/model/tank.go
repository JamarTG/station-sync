package model

type Tank struct {
	ID              string  `db:"id" json:"id"`
	FuelID          string  `db:"fuel_id" json:"fuel_id"`
	MaximumCapacity float64 `db:"maximum_capacity" json:"maximum_capacity"`
}