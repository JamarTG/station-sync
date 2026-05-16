import type { ActivityRow } from '../components/dashboard/RecentActivityCard'
import type { AccountType } from '../components/dashboard/AccountsPanel'

const depositSources: AccountType[] = ['Cash', 'Card', 'FX', 'Advance', 'Charges']

export function computeAllBalances(
  attendantSales: Record<string, number>,
  activityByAccount: Record<AccountType, ActivityRow[]>
): Record<string, number> {
  const totalDeposited: Record<string, number> = {}
  for (const source of depositSources) {
    for (const row of activityByAccount[source] ?? []) {
      if (row.type === 'expenditure' || row.type === 'attendants' || row.type === 'deposit') continue
      if ('name' in row) {
        const name = (row as { name: string }).name
        totalDeposited[name] = (totalDeposited[name] ?? 0) + row.amount
      }
    }
  }
  return Object.fromEntries(
    Object.entries(attendantSales).map(([name, sales]) => [name, (totalDeposited[name] ?? 0) - sales])
  )
}
