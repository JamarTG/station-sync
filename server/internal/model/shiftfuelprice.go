package model

type ShiftFuelPrice struct {
	FuelID  string  `db:"fuel_id"`
	ShiftID string  `db:"shift_id"`
	Price   float64 `db:"price"`
}