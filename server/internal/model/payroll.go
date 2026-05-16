package model

import "time"

type PayrollPeriodStatus string

const (
	PeriodDraft     PayrollPeriodStatus = "Draft"
	PeriodPublished PayrollPeriodStatus = "Published"
)

type PayrollPeriod struct {
	ID        string              `db:"id" json:"id"`
	StartDate time.Time           `db:"start_date" json:"start_date"`
	EndDate   time.Time           `db:"end_date" json:"end_date"`
	Status    PayrollPeriodStatus `db:"status" json:"status"`
	CreatedAt time.Time           `db:"created_at" json:"created_at"`
}

type PayrollRecord struct {
	ID              string    `db:"id" json:"id"`
	PeriodID        string    `db:"period_id" json:"period_id"`
	PeriodStartDate time.Time `db:"period_start_date" json:"period_start_date"`
	PeriodEndDate   time.Time `db:"period_end_date" json:"period_end_date"`
	PeriodStatus    string    `db:"period_status" json:"period_status"`
	UserID          string    `db:"user_id" json:"user_id"`
	UserName        string    `db:"user_name" json:"user_name"`
	UserRole        string    `db:"user_role" json:"user_role"`
	GrossPay        float64   `db:"gross_pay" json:"gross_pay"`
	NIS             float64   `db:"nis" json:"nis"`
	NHT             float64   `db:"nht" json:"nht"`
	EdTax           float64   `db:"ed_tax" json:"ed_tax"`
	PAYE            float64   `db:"paye" json:"paye"`
	NetPay          float64   `db:"net_pay" json:"net_pay"`
	HoursWorked     *float64  `db:"hours_worked" json:"hours_worked"`
	Overage         float64   `db:"overage" json:"overage"`
	Shortage        float64   `db:"shortage" json:"shortage"`
	CreatedAt       time.Time `db:"created_at" json:"created_at"`
}
