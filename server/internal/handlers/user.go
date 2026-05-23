package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"project-sync/internal/model"
)

type UserHandler struct {
	DB *pgxpool.Pool
}

const userSelectCols = `id::text, business_id::text, branch_id::text, name, role, email, active,
	COALESCE(phone,''), COALESCE(nis,''), COALESCE(trn,''),
	employed_on::text, date_of_birth::text, must_change_password, pay_rate, pay_type, sick_days`

func scanUser(row interface {
	Scan(...any) error
}, u *model.User) error {
	return row.Scan(&u.ID, &u.BusinessID, &u.BranchID, &u.Name, &u.Role, &u.Email, &u.Active,
		&u.Phone, &u.NIS, &u.TRN, &u.EmployedOn, &u.DateOfBirth, &u.MustChangePassword,
		&u.PayRate, &u.PayType, &u.SickDays)
}

func (h *UserHandler) List(c *gin.Context) {
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT `+userSelectCols+`,
			(SELECT pr.net_pay FROM payroll_records pr
			 JOIN payroll_periods pp ON pp.id = pr.period_id
			 WHERE pr.user_id = u.id
			 ORDER BY pp.start_date DESC LIMIT 1) AS latest_net_pay
		FROM users u
		WHERE business_id = $1
		ORDER BY name`,
		businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	users := []model.User{}
	for rows.Next() {
		var u model.User
		if err := rows.Scan(
			&u.ID, &u.BusinessID, &u.BranchID, &u.Name, &u.Role, &u.Email, &u.Active,
			&u.Phone, &u.NIS, &u.TRN, &u.EmployedOn, &u.DateOfBirth, &u.MustChangePassword,
			&u.PayRate, &u.PayType, &u.SickDays, &u.LatestNetPay,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		users = append(users, u)
	}
	c.JSON(http.StatusOK, users)
}

func (h *UserHandler) Get(c *gin.Context) {
	businessID := c.GetString("business_id")
	var u model.User
	err := scanUser(
		h.DB.QueryRow(c.Request.Context(),
			`SELECT `+userSelectCols+` FROM users WHERE id = $1 AND business_id = $2`,
			c.Param("id"), businessID),
		&u,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, u)
}

func (h *UserHandler) UpdatePay(c *gin.Context) {
	var body struct {
		PayRate *float64 `json:"pay_rate"`
		PayType *string  `json:"pay_type"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var u model.User
	err := scanUser(h.DB.QueryRow(c.Request.Context(), `
		UPDATE users SET pay_rate = $1, pay_type = $2
		WHERE id = $3
		RETURNING `+userSelectCols,
		body.PayRate, body.PayType, c.Param("id"),
	), &u)
	if err == pgx.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, u)
}

func (h *UserHandler) Create(c *gin.Context) {
	businessID := c.GetString("business_id")
	branchID := c.GetString("branch_id")
	var body struct {
		Name        string   `json:"name" binding:"required"`
		Role        string   `json:"role" binding:"required"`
		Password    string   `json:"password" binding:"required"`
		Phone       string   `json:"phone"`
		NIS         string   `json:"nis"`
		TRN         string   `json:"trn"`
		Email       string   `json:"email" binding:"required"`
		EmployedOn  string   `json:"employed_on"`
		DateOfBirth string   `json:"date_of_birth"`
		BranchID    string   `json:"branch_id"`
		SickDays    *int     `json:"sick_days"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.BranchID != "" {
		branchID = body.BranchID
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer tx.Rollback(ctx)

	var u model.User
	err = scanUser(
		tx.QueryRow(ctx, `
			INSERT INTO users (business_id, branch_id, name, role, password_hash, phone, nis, trn, email,
			                   employed_on, date_of_birth, must_change_password, sick_days)
			VALUES ($1, NULLIF($2,'')::uuid, $3, $4, $5, $6, $7, $8, $9,
			        NULLIF($10,'')::date, NULLIF($11,'')::date, true, $12)
			RETURNING `+userSelectCols,
			businessID, branchID, body.Name, body.Role, string(hash),
			body.Phone, body.NIS, body.TRN, body.Email,
			body.EmployedOn, body.DateOfBirth, body.SickDays,
		),
		&u,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Every staff member automatically gets a customer account.
	if _, err := tx.Exec(ctx, `
		INSERT INTO customers (business_id, user_id, name, phone, email)
		VALUES ($1, $2, $3, NULLIF($4,''), NULLIF($5,''))`,
		businessID, u.ID, u.Name, body.Phone, body.Email,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, u)
}

func (h *UserHandler) ListAttendance(c *gin.Context) {
	businessID := c.GetString("business_id")
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT sa.id::text, sa.shift_id::text, sa.user_id::text, u.name,
		       sa.pump_id::text, p.name, sa.clock_in::text, sa.clock_out::text,
		       s.date::text
		FROM shift_attendance sa
		JOIN shifts s ON s.id = sa.shift_id AND s.business_id = $2
		JOIN users u ON u.id = sa.user_id
		LEFT JOIN pumps p ON p.id = sa.pump_id
		WHERE sa.user_id = $1
		ORDER BY sa.clock_in DESC
		LIMIT 50`,
		c.Param("id"), businessID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	records := []model.ShiftAttendance{}
	for rows.Next() {
		var a model.ShiftAttendance
		if err := rows.Scan(&a.ID, &a.ShiftID, &a.UserID, &a.UserName,
			&a.PumpID, &a.PumpName, &a.ClockIn, &a.ClockOut, &a.ShiftDate); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		records = append(records, a)
	}
	c.JSON(http.StatusOK, records)
}

func (h *UserHandler) ChangePassword(c *gin.Context) {
	userID := c.GetString("user_id")
	var body struct {
		CurrentPassword string `json:"current_password" binding:"required"`
		NewPassword     string `json:"new_password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var hash string
	if err := h.DB.QueryRow(c.Request.Context(),
		`SELECT password_hash FROM users WHERE id = $1`, userID,
	).Scan(&hash); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(body.CurrentPassword)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "current password is incorrect"})
		return
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(body.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if _, err := h.DB.Exec(c.Request.Context(),
		`UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2`,
		string(newHash), userID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *UserHandler) Update(c *gin.Context) {
	businessID := c.GetString("business_id")
	var body struct {
		Name        *string `json:"name"`
		Role        *string `json:"role"`
		Email       *string `json:"email"`
		Phone       *string `json:"phone"`
		NIS         *string `json:"nis"`
		TRN         *string `json:"trn"`
		EmployedOn  *string `json:"employed_on"`
		DateOfBirth *string `json:"date_of_birth"`
		Active      *bool   `json:"active"`
		SickDays    *int    `json:"sick_days"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var u model.User
	err := scanUser(
		h.DB.QueryRow(c.Request.Context(), `
			UPDATE users SET
				name          = COALESCE($3, name),
				role          = COALESCE($4, role),
				email         = COALESCE($5, email),
				phone         = COALESCE($6, phone),
				nis           = COALESCE($7, nis),
				trn           = COALESCE($8, trn),
				employed_on   = COALESCE(NULLIF($9,'')::date, employed_on),
				date_of_birth = COALESCE(NULLIF($10,'')::date, date_of_birth),
				active        = COALESCE($11, active),
				sick_days     = COALESCE($12, sick_days)
			WHERE id = $1 AND business_id = $2
			RETURNING `+userSelectCols,
			c.Param("id"), businessID,
			body.Name, body.Role, body.Email, body.Phone, body.NIS, body.TRN,
			func() string { if body.EmployedOn != nil { return *body.EmployedOn }; return "" }(),
			func() string { if body.DateOfBirth != nil { return *body.DateOfBirth }; return "" }(),
			body.Active, body.SickDays,
		),
		&u,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, u)
}
