import { useQuery } from '@tanstack/react-query'
import { api, type Fuel, type Pump, type Shift, type FuelSummary, type User, type PayrollPeriod, type PayrollRecord } from '../lib/api'

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

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<User[]>('/users').then((r) => r.data),
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

export function useUserPayroll(userId: string | null) {
  return useQuery({
    queryKey: ['user-payroll', userId],
    queryFn: () => api.get<PayrollRecord[]>(`/users/${userId}/payroll`).then((r) => r.data),
    enabled: !!userId,
  })
}
