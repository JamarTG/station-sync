import type { ActivityRow } from '../components/dashboard/RecentActivityCard'
import { activityByAccount } from '../components/dashboard/RecentActivityCard'

function sumForAttendant(rows: ActivityRow[], name: string): number {
  return rows.reduce((s, r) => {
    if (r.type === 'expenditure' || r.type === 'attendants' || r.type === 'deposit') return s
    return r.name === name ? s + r.amount : s
  }, 0)
}

export function totalRecordedForAttendant(name: string): number {
  return (
    sumForAttendant(activityByAccount.Cash, name) +
    sumForAttendant(activityByAccount.Card, name) +
    sumForAttendant(activityByAccount.Charges, name) +
    sumForAttendant(activityByAccount.Advance, name) +
    sumForAttendant(activityByAccount.FX, name)
  )
}

export function computeAllBalances(attendantSales: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(attendantSales).map(([name, sales]) => [
      name,
      totalRecordedForAttendant(name) - sales,
    ])
  )
}
