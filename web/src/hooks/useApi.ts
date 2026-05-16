import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Fuel, type Pump, type Shift, type FuelSummary, type User, type PayrollPeriod, type PayrollRecord, type ShiftAttendance } from '../lib/api'

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

export function useShiftForDate(date: string) {
  return useQuery({
    queryKey: ['shifts', date],
    queryFn: () => api.get<Shift[]>(`/shifts?date=${date}`).then((r) => r.data[0] ?? null),
  })
}

export function useFuelSummary(pumpId: string | undefined, shiftId: string | undefined) {
  return useQuery({
    queryKey: ['fuel-summary', pumpId, shiftId],
    queryFn: () => api.get<FuelSummary[]>(`/pumps/${pumpId}/shifts/${shiftId}/fuel-summary`).then((r) => r.data),
    enabled: !!pumpId && !!shiftId,
  })
}

export function useShiftAttendance(shiftId: string | undefined) {
  return useQuery({
    queryKey: ['attendance', shiftId],
    queryFn: () => api.get<ShiftAttendance[]>(`/shifts/${shiftId}/attendance`).then((r) => r.data),
    enabled: !!shiftId,
  })
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<User[]>('/users').then((r) => r.data),
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
    nis: string; trn: string; email: string; employed_on: string; pay_rate: string; pay_type: string
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

export function useUserPayroll(userId: string | null) {
  return useQuery({
    queryKey: ['user-payroll', userId],
    queryFn: () => api.get<PayrollRecord[]>(`/users/${userId}/payroll`).then((r) => r.data),
    enabled: !!userId,
  })
}
