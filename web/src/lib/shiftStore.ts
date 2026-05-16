export type ShiftStatus = 'open' | 'closed'

export const defaultFuelPrices: Record<string, number> = {
  '87': 190.90,
  '90': 190.90,
  'ADO': 190.90,
  'ULSD': 190.90,
}

export interface AttendantEntry {
  name: string
  pump: string
  clockIn: string
}

export interface ShiftData {
  status: ShiftStatus
  fuelPrices: Record<string, number>
  pumpOpenings: Record<string, string[]>
  tankOpenings: Record<string, string>
  attendants: AttendantEntry[]
  userName?: string
}

const KEY = 'ss_shift'

export function getShiftData(): ShiftData | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as ShiftData) : null
  } catch {
    return null
  }
}

export function saveShiftData(patch: Partial<ShiftData>) {
  const base: ShiftData = getShiftData() ?? {
    status: 'open',
    fuelPrices: defaultFuelPrices,
    pumpOpenings: {},
    tankOpenings: {},
    attendants: [],
  }
  localStorage.setItem(KEY, JSON.stringify({ ...base, ...patch }))
}
