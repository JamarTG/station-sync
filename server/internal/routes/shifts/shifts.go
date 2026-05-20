package shifts

import (
	"project-sync/internal/handlers"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterRoute(g *gin.RouterGroup, db *pgxpool.Pool) {
	sh := &handlers.ShiftHandler{DB: db}
	dh := &handlers.DepositHandler{DB: db}
	nlh := &handlers.NozzleLogHandler{DB: db}
	tlh := &handlers.TankLogHandler{DB: db}
	fph := &handlers.ShiftFuelPriceHandler{DB: db}
	ah := &handlers.ShiftAttendanceHandler{DB: db}
	frh := &handlers.FuelReceivalHandler{DB: db}

	shifts := g.Group("/shifts")
	shifts.GET("", sh.List)
	shifts.POST("", sh.Create)
	shifts.GET("/open", sh.GetOpen)
	shifts.GET("/:shiftId", sh.Get)
	shifts.PATCH("/:shiftId/close", sh.Close)

	shifts.GET("/:shiftId/deposits", dh.ListByShift)
	shifts.POST("/:shiftId/deposits", dh.Create)
	shifts.PATCH("/:shiftId/deposits/:id", dh.Update)
	shifts.DELETE("/:shiftId/deposits/:id", dh.Delete)

	shifts.GET("/:shiftId/nozzle-logs", nlh.ListByShift)
	shifts.POST("/:shiftId/nozzle-logs", nlh.Create)

	shifts.GET("/:shiftId/tank-logs", tlh.ListByShift)
	shifts.POST("/:shiftId/tank-logs", tlh.Upsert)

	shifts.GET("/:shiftId/fuel-prices", fph.ListByShift)
	shifts.POST("/:shiftId/fuel-prices", fph.Upsert)

	shifts.GET("/:shiftId/attendance", ah.ListByShift)
	shifts.POST("/:shiftId/attendance/clock-in", ah.ClockIn)
	shifts.PATCH("/:shiftId/attendance/:id", ah.UpdateAttendance)
	shifts.DELETE("/:shiftId/attendance/:id", ah.DeleteAttendance)
	shifts.PATCH("/:shiftId/attendance/:id/clock-out", ah.ClockOut)

	shifts.GET("/:shiftId/fuel-receivals", frh.ListByShift)
	shifts.POST("/:shiftId/fuel-receivals", frh.Create)
}
