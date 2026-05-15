package routes

import (
	"project-sync/internal/handlers"
	"project-sync/internal/routes/days"
	"project-sync/internal/routes/fuels"
	"project-sync/internal/routes/payroll"
	"project-sync/internal/routes/pumps"
	"project-sync/internal/routes/shiftschedules"
	"project-sync/internal/routes/shifts"
	"project-sync/internal/routes/tanks"
	"project-sync/internal/routes/users"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func Register(r *gin.Engine, db *pgxpool.Pool) {
	v1 := r.Group("v1")

	days.RegisterRoute(v1, db)
	fuels.RegisterRoute(v1, db)
	users.RegisterRoute(v1, db)
	pumps.RegisterRoute(v1, db)
	tanks.RegisterRoute(v1, db)
	shiftschedules.RegisterRoute(v1, db)
	shifts.RegisterRoute(v1, db)
	payroll.RegisterRoute(v1, db)

	nlh := &handlers.NozzleLogHandler{DB: db}
	v1.POST("/nozzle-logs", nlh.Create)
}
