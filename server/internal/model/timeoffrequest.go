package model

type TimeOffRequest struct {
	ID             string  `json:"id"`
	BusinessID     string  `json:"business_id"`
	UserID         string  `json:"user_id"`
	UserName       string  `json:"user_name"`
	Date           string  `json:"date"`
	Reason         *string `json:"reason"`
	Status         string  `json:"status"`
	ReviewedBy     *string `json:"reviewed_by"`
	ReviewedByName *string `json:"reviewed_by_name"`
	ReviewedAt     *string `json:"reviewed_at"`
	CreatedAt      string  `json:"created_at"`
}
