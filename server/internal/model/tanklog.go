package model

type TankLog struct {
	ID             string   `json:"id"`
	TankID         string   `json:"tank_id"`
	ShiftID        string   `json:"shift_id"`
	OpeningLevel   *float64 `json:"opening_level"`
	ClosingLevel   *float64 `json:"closing_level"`
	DeliveryLitres *float64 `json:"delivery_litres"`
}
