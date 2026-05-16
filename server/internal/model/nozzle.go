package model

type Nozzle struct {
	ID       string `db:"id" json:"id"`
	PumpID   string `db:"pump_id" json:"pump_id"`
	FuelID   string `db:"fuel_id" json:"fuel_id"`
	FuelName string `db:"fuel_name" json:"fuel_name"`
}