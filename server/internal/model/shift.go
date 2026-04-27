package model

type Shift struct {
	ID           string `db:"id"`
	SupervisorID string `db:"supervisor_id"`
	Date         string `db:"date"`
	StartTime    string `db:"start_time"`
	EndTime      string `db:"end_time"`
	CreatedAt    string `db:"created_at"`
}