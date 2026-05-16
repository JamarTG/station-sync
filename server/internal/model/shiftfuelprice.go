package model

type ShiftFuelPrice struct {
	FuelID   string  `db:"fuel_id" json:"fuel_id"`
	ShiftID  string  `db:"shift_id" json:"shift_id"`
	Price    float64 `db:"price" json:"price"`
	FuelName string  `db:"fuel_name" json:"fuel_name"`
}