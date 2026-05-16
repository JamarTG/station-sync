package model

type Pump struct {
	ID          string `db:"id" json:"id"`
	BranchID    string `db:"branch_id" json:"branch_id"`
	Name        string `db:"name" json:"name"`
	Description string `db:"description" json:"description"`
}
