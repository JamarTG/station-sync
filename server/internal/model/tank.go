package model

type Tank struct {
	ID              string  `db:"id"`
	FuelID          string  `db:"fuel_id"`
	MaximumCapacity float64 `db:"maximum_capacity"`
}