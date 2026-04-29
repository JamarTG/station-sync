import { useQuery } from '@tanstack/react-query'
import { api, type Fuel, type Pump, type Shift, type FuelSummary } from '../lib/api'

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
    queryFn: () =>
      api.get<FuelSummary[]>(`/pumps/${pumpId}/shifts/${shiftId}/fuel-summary`).then((r) => r.data),
    enabled: !!pumpId && !!shiftId,
  })
}
