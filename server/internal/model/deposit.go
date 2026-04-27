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
	ID          string       `db:"id"`
	ShiftID     string       `db:"shift_id"`
	AttendantID string       `db:"attendant_id"`
	Type        DepositType  `db:"type"`
	Amount      float64      `db:"amount"`
	Metadata    *string      `db:"metadata"`
}