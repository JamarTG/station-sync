package model

type Nozzle struct {
	ID     string `db:"id"`
	PumpID string `db:"pump_id"`
	FuelID string `db:"fuel_id"`
}