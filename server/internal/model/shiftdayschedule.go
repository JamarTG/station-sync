package model

type ShiftScheduleDay struct {
	ShiftScheduleID string `db:"shift_schedule_id"`
	DayID           string `db:"day_id"`
}