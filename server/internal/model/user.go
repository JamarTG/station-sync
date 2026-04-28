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
	ID           string    `db:"id"`
	Name         string    `db:"name"`
	Role         UserRole  `db:"role"`
	PasswordHash string    `db:"password_hash"`
	Active       bool      `db:"active"`
	EmployedOn   *time.Time `db:"employed_on"`
	DateOfBirth  *time.Time `db:"date_of_birth"`
	Phone        string    `db:"phone"`
	NIS          string    `db:"nis"`
	TRN          string    `db:"trn"`
	Email        string    `db:"email"`
}