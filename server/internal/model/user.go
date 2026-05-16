package model

import "time"

type UserRole string

const (
	RoleSupervisor UserRole = "Supervisor"
	RoleAdmin      UserRole = "Admin"
	RoleAttendant  UserRole = "Attendant"
	RoleManager    UserRole = "Manager"
)

type User struct {
	ID           string     `db:"id" json:"id"`
	Name         string     `db:"name" json:"name"`
	Role         UserRole   `db:"role" json:"role"`
	PasswordHash string     `db:"password_hash" json:"-"`
	Active       bool       `db:"active" json:"active"`
	EmployedOn   *time.Time `db:"employed_on" json:"employed_on"`
	DateOfBirth  *time.Time `db:"date_of_birth" json:"date_of_birth"`
	Phone        string     `db:"phone" json:"phone"`
	NIS          string     `db:"nis" json:"nis"`
	TRN          string     `db:"trn" json:"trn"`
	Email        string     `db:"email" json:"email"`
	PayRate      *float64   `db:"pay_rate" json:"pay_rate"`
	PayType      *string    `db:"pay_type" json:"pay_type"`
	LatestNetPay *float64   `db:"latest_net_pay" json:"latest_net_pay"`
}