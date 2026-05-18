package model

type UserRole string

const (
	RolePlatformAdmin UserRole = "Super Duper Admin"
	RoleSuperAdmin    UserRole = "Super Admin"
	RoleBranchAdmin   UserRole = "Branch Admin"
	RoleSupervisor    UserRole = "Supervisor"
	RoleManager       UserRole = "Manager"
	RoleCashier       UserRole = "Cashier"
	RoleAttendant     UserRole = "Attendant"
)

type User struct {
	ID                   string   `db:"id" json:"id"`
	BusinessID           string   `db:"business_id" json:"business_id"`
	BusinessName         string   `db:"-" json:"business_name"`
	BusinessAddressLine1 string   `db:"-" json:"business_address_line1"`
	BusinessAddressLine2 string   `db:"-" json:"business_address_line2"`
	BusinessCity         string   `db:"-" json:"business_city"`
	BusinessParish       string   `db:"-" json:"business_parish"`
	BranchID             *string  `db:"branch_id" json:"branch_id"`
	Name                 string   `db:"name" json:"name"`
	Role                 UserRole `db:"role" json:"role"`
	Email                string   `db:"email" json:"email"`
	Active               bool     `db:"active" json:"active"`
	Phone                string   `db:"phone" json:"phone"`
	NIS                  string   `db:"nis" json:"nis"`
	TRN                  string   `db:"trn" json:"trn"`
	EmployedOn           *string  `db:"employed_on" json:"employed_on"`
	DateOfBirth          *string  `db:"date_of_birth" json:"date_of_birth"`
	MustChangePassword   bool     `db:"must_change_password" json:"must_change_password"`
	PayRate              *float64 `db:"pay_rate" json:"pay_rate"`
	PayType              *string  `db:"pay_type" json:"pay_type"`
	LatestNetPay         *float64 `db:"latest_net_pay" json:"latest_net_pay,omitempty"`
}
