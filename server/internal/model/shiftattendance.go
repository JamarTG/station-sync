package model

type ShiftAttendance struct {
	ID       string `db:"id" json:"id"`
	ShiftID  string `db:"shift_id" json:"shift_id"`
	UserID   string `db:"user_id" json:"user_id"`
	ClockIn  string `db:"clock_in" json:"clock_in"`
	ClockOut *string `db:"clock_out" json:"clock_out"`
}