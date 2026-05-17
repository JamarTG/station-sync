package model

type ShiftAttendance struct {
	ID       string  `db:"id" json:"id"`
	ShiftID  string  `db:"shift_id" json:"shift_id"`
	UserID   string  `db:"user_id" json:"user_id"`
	UserName string  `db:"user_name" json:"user_name"`
	PumpID   *string `db:"pump_id" json:"pump_id"`
	ClockIn  string  `db:"clock_in" json:"clock_in"`
	ClockOut *string `db:"clock_out" json:"clock_out"`
}
