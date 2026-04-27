package model

type TankLog struct {
	ID              string  `db:"id"`
	TankID          string  `db:"tank_id"`
	ShiftID         string  `db:"shift_id"`
	BeforeVolume    float64 `db:"before_volume"`
	AfterVolume     float64 `db:"after_volume"`
	DispensedVolume float64 `db:"dispensed_volume"`
	Timestamp       string  `db:"timestamp"`
}