import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  api,
  getBranches,
  getOpenShift,
  getShiftFuelPrices,
  getShiftAttendance,
  getShiftDeposits,
  getUsers,
  getNozzles,
  getTanks,
  getShiftTankLogs,
  getShiftFuelReceivals,
  getTimeOffRequests,
  type Branch,
  type Fuel,
  type FuelReceival,
  type Nozzle,
  type Pump,
  type Shift,
  type FuelSummary,
  type Tank,
  type TankLog,
  type TimeOffRequest,
  type User,
  type PayrollPeriod,
  type PayrollRecord,
  type ShiftAttendance,
} from '../lib/api'

export function useBranches() {
  return useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: getBranches,
  })
}

export function useFuels() {
  return useQuery({
    queryKey: ['fuels'],
    queryFn: () => api.get<Fuel[]>('/fuels').then((r) => r.data),
  })
}

export function usePumps() {
  return useQuery({
    queryKey: ['pumps'],
    queryFn: () => api.get<Pump[]>('/pumps').then((r) => r.data),
  })
}

export function useNozzles() {
  return useQuery<Nozzle[]>({
    queryKey: ['nozzles'],
    queryFn: getNozzles,
  })
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  })
}

export function useOpenShift() {
  return useQuery({
    queryKey: ['shifts', 'open'],
    queryFn: getOpenShift,
  })
}

export function useShiftFuelPrices(shiftId: string | undefined) {
  return useQuery({
    queryKey: ['shifts', shiftId, 'fuel-prices'],
    queryFn: () => getShiftFuelPrices(shiftId!),
    enabled: !!shiftId,
  })
}

export function useShiftAttendance(shiftId: string | undefined) {
  return useQuery({
    queryKey: ['shifts', shiftId, 'attendance'],
    queryFn: () => getShiftAttendance(shiftId!),
    enabled: !!shiftId,
  })
}

export function useShiftDeposits(shiftId: string | undefined) {
  return useQuery({
    queryKey: ['shifts', shiftId, 'deposits'],
    queryFn: () => getShiftDeposits(shiftId!),
    enabled: !!shiftId,
  })
}

export function useShiftsInRange(start: string, end: string) {
  return useQuery({
    queryKey: ['shifts', 'range', start, end],
    queryFn: () => api.get<Shift[]>(`/shifts?start=${start}&end=${end}`).then((r) => r.data),
  })
}

export function useShiftForDate(date: string) {
  return useQuery({
    queryKey: ['shifts', date],
    queryFn: () => api.get<Shift[]>(`/shifts?date=${date}`).then((r) => r.data[0] ?? null),
  })
}

export function useFuelSummary(pumpId: string | undefined, shiftId: string | undefined) {
  return useQuery({
    queryKey: ['fuel-summary', pumpId, shiftId],
    queryFn: () =>
      api.get<FuelSummary[]>(`/pumps/${pumpId}/shifts/${shiftId}/fuel-summary`).then((r) => r.data),
    enabled: !!pumpId && !!shiftId,
  })
}

export function useTanks() {
  return useQuery<Tank[]>({
    queryKey: ['tanks'],
    queryFn: getTanks,
  })
}

export function useShiftTankLogs(shiftId: string | undefined) {
  return useQuery<TankLog[]>({
    queryKey: ['shifts', shiftId, 'tank-logs'],
    queryFn: () => getShiftTankLogs(shiftId!),
    enabled: !!shiftId,
  })
}

export function useShiftFuelReceivals(shiftId: string | undefined) {
  return useQuery<FuelReceival[]>({
    queryKey: ['shifts', shiftId, 'fuel-receivals'],
    queryFn: () => getShiftFuelReceivals(shiftId!),
    enabled: !!shiftId,
  })
}

export function usePayrollWeeklySummary() {
  return useQuery({
    queryKey: ['payroll-weekly-summary'],
    queryFn: () => api.get<{ total_overage: number; total_shortage: number; week_start: string; week_end: string }>('/payroll/weekly-summary').then((r) => r.data),
  })
}

export function usePayrollPeriods() {
  return useQuery({
    queryKey: ['payroll-periods'],
    queryFn: () => api.get<PayrollPeriod[]>('/payroll/periods').then((r) => r.data),
  })
}

export function usePayrollRecords(periodId: string | null) {
  return useQuery({
    queryKey: ['payroll-records', periodId],
    queryFn: () => api.get<PayrollRecord[]>(`/payroll/periods/${periodId}/records`).then((r) => r.data),
    enabled: !!periodId,
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return async (body: {
    name: string; role: string; password: string; phone: string
    nis: string; trn: string; email: string; employed_on: string
    pay_rate: string; pay_type: string; sick_days: string
  }) => {
    const res = await api.post<User>('/users', body)
    await qc.invalidateQueries({ queryKey: ['users'] })
    return res.data
  }
}

export function useUpdatePay() {
  const qc = useQueryClient()
  return async (userId: string, pay_rate: number | null, pay_type: string | null) => {
    const res = await api.patch<User>(`/users/${userId}/pay`, { pay_rate, pay_type })
    await qc.invalidateQueries({ queryKey: ['users'] })
    return res.data
  }
}

export function useTimeOffRequests() {
  return useQuery<TimeOffRequest[]>({
    queryKey: ['time-off-requests'],
    queryFn: getTimeOffRequests,
  })
}

export function useUserPayroll(userId: string | null) {
  return useQuery({
    queryKey: ['user-payroll', userId],
    queryFn: () => api.get<PayrollRecord[]>(`/users/${userId}/payroll`).then((r) => r.data),
    enabled: !!userId,
  })
}
