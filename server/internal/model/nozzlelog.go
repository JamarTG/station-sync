package model

type NozzleLog struct {
	ID              string  `db:"id"`
	NozzleID        string  `db:"nozzle_id"`
	ShiftID         string  `db:"shift_id"`
	StartingReading float64 `db:"starting_reading"`
	EndingReading   float64 `db:"ending_reading"`
}