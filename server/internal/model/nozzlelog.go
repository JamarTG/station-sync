package model

type NozzleLog struct {
	ID              string  `db:"id" json:"id"`
	NozzleID        string  `db:"nozzle_id" json:"nozzle_id"`
	ShiftID         string  `db:"shift_id" json:"shift_id"`
	StartingReading float64 `db:"starting_reading" json:"starting_reading"`
	EndingReading   float64 `db:"ending_reading" json:"ending_reading"`
}