package model

type TankLog struct {
	ID              string  `db:"id" json:"id"`
	TankID          string  `db:"tank_id" json:"tank_id"`
	ShiftID         string  `db:"shift_id" json:"shift_id"`
	BeforeVolume    float64 `db:"before_volume" json:"before_volume"`
	AfterVolume     float64 `db:"after_volume" json:"after_volume"`
	DispensedVolume float64 `db:"dispensed_volume" json:"dispensed_volume"`
	Timestamp       string  `db:"timestamp" json:"timestamp"`
}