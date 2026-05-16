package model

type Tank struct {
	ID             string  `json:"id"`
	BusinessID     string  `json:"business_id"`
	BranchID       string  `json:"branch_id"`
	FuelID         string  `json:"fuel_id"`
	FuelName       string  `json:"fuel_name"`
	Name           string  `json:"name"`
	CapacityLitres float64 `json:"capacity_litres"`
}
