package model

type ShiftSchedule struct {
	ID            string `db:"id" json:"id"`
	Name          string `db:"name" json:"name"`
	StartTime     string `db:"start_time" json:"start_time"`
	EndTime       string `db:"end_time" json:"end_time"`
	EffectiveDate string `db:"effective_date" json:"effective_date"`
}