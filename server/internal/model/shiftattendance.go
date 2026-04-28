package model

type ShiftAttendance struct {
	ID       string `db:"id"`
	ShiftID  string `db:"shift_id"`
	UserID   string `db:"user_id"`
	ClockIn  string `db:"clock_in"`
	ClockOut *string `db:"clock_out"`
}