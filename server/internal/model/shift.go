package model

type Shift struct {
	ID           string  `db:"id" json:"id"`
	BusinessID   string  `db:"business_id" json:"business_id"`
	BranchID     string  `db:"branch_id" json:"branch_id"`
	SupervisorID string  `db:"supervisor_id" json:"supervisor_id"`
	Date         string  `db:"date" json:"date"`
	StartTime    string  `db:"start_time" json:"start_time"`
	EndTime      *string `db:"end_time" json:"end_time"`
	CreatedAt    string  `db:"created_at" json:"created_at"`
}
