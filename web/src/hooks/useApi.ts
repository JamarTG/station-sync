import { useQuery } from '@tanstack/react-query'
import {
  api,
  getBranches,
  getOpenShift,
  getShiftFuelPrices,
  getShiftAttendance,
  getShiftDeposits,
  getUsers,
  getNozzles,
  getPumpNozzles,
  getTanks,
  getShiftTankLogs,
  getShiftFuelReceivals,
  type Branch,
  type Fuel,
  type FuelReceival,
  type Nozzle,
  type Pump,
  type Shift,
  type FuelSummary,
  type Tank,
  type TankLog,
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
