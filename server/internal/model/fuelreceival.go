package model

type FuelReceival struct {
	ID            string   `json:"id"`
	ShiftID       string   `json:"shift_id"`
	TankID        *string  `json:"tank_id"`
	FuelName      string   `json:"fuel_name"`
	LitresOrdered float64  `json:"litres_ordered"`
	OpeningLevel  *float64 `json:"opening_level"`
	ClosingLevel  *float64 `json:"closing_level"`
	Rate          *float64 `json:"rate"`
	Haulage       *float64 `json:"haulage"`
	Gct           *float64 `json:"gct"`
	InvoiceNo     *string  `json:"invoice_no"`
}
