package model

type ShiftSchedule struct {
	ID            string `db:"id"`
	Name          string `db:"name"`
	StartTime     string `db:"start_time"`
	EndTime       string `db:"end_time"`
	EffectiveDate string `db:"effective_date"`
}