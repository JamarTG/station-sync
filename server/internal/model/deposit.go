package model

type DepositType string

const (
	DepositCash    DepositType = "Cash"
	DepositCard    DepositType = "Card"
	DepositCharge  DepositType = "Charge"
	DepositFX      DepositType = "FX"
	DepositAdvance DepositType = "Advance"
)

type Deposit struct {
	ID          string       `db:"id" json:"id"`
	ShiftID     string       `db:"shift_id" json:"shift_id"`
	AttendantID string       `db:"attendant_id" json:"attendant_id"`
	Type        DepositType  `db:"type" json:"type"`
	Amount      float64      `db:"amount" json:"amount"`
	Metadata    *string      `db:"metadata" json:"metadata"`
}