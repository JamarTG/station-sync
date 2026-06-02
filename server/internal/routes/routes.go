package routes

import (
	"project-sync/internal/handlers"
	"project-sync/internal/middleware"
	"project-sync/internal/routes/auth"
	"project-sync/internal/routes/days"
	"project-sync/internal/routes/fuels"
	"project-sync/internal/routes/payroll"
	"project-sync/internal/routes/platform"
	"project-sync/internal/routes/pumps"
	"project-sync/internal/routes/shifts"
	"project-sync/internal/routes/shiftschedules"
	"project-sync/internal/routes/employeescores"
	"project-sync/internal/routes/fuelintelligence"
	"project-sync/internal/routes/holidays"
	"project-sync/internal/routes/loyalty"
	"project-sync/internal/routes/sps"
	syncroutes "project-sync/internal/routes/sync"
	"project-sync/internal/routes/tanks"
	"project-sync/internal/routes/timeoff"
	"project-sync/internal/routes/users"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func Register(r *gin.Engine, db *pgxpool.Pool) {
	v1 := r.Group("/v1")

	// Public routes (no auth required)
	auth.RegisterRoute(v1, db)

	// Protected routes (require valid session token)
	protected := v1.Group("")
	protected.Use(middleware.RequireAuth(db))

	days.RegisterRoute(protected, db)
	fuels.RegisterRoute(protected, db)
	users.RegisterRoute(protected, db)
	pumps.RegisterRoute(protected, db)
	tanks.RegisterRoute(protected, db)
	shiftschedules.RegisterRoute(protected, db)
	shifts.RegisterRoute(protected, db)
	payroll.RegisterRoute(protected, db)
	timeoff.RegisterRoute(protected, db)

	bh := &handlers.BranchHandler{DB: db}
	protected.GET("/branches", bh.List)
	protected.POST("/branches", bh.Create)

	ch := &handlers.CustomerHandler{DB: db}
	protected.GET("/customers", ch.List)
	protected.POST("/customers", ch.Create)
	protected.PATCH("/customers/:id", ch.Update)
	protected.GET("/customers/:id/orders", ch.ListOrders)

	ph := &handlers.ProductHandler{DB: db}
	protected.GET("/products", ph.List)
	protected.POST("/products", ph.Create)
	protected.PATCH("/products/:id", ph.Update)
	protected.DELETE("/products/:id", ph.Delete)

	nh := &handlers.NozzleHandler{DB: db}
	protected.GET("/nozzles", nh.List)

	nlh := &handlers.NozzleLogHandler{DB: db}
	protected.POST("/nozzle-logs", nlh.Create)

	ih := &handlers.IssueHandler{DB: db}
	protected.GET("/issues", ih.List)
	protected.POST("/issues", ih.Create)
	protected.PATCH("/issues/:id/status", ih.UpdateStatus)

	platform.RegisterRoute(protected, db)
	sps.RegisterRoute(protected, db)
	fuelintelligence.RegisterRoute(protected, db)
	employeescores.RegisterRoute(protected, db)
	holidays.RegisterRoute(protected, db)
	loyalty.RegisterRoute(protected, db)
	syncroutes.RegisterRoute(protected, db)
}
