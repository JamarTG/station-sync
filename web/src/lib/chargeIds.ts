const CHARGE_IDS_KEY = 'ss_charge_customer_ids'

export function loadChargeIds(): Set<string> {
  try {
    const raw = localStorage.getItem(CHARGE_IDS_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch { return new Set() }
}

export function saveChargeId(id: string) {
  const ids = loadChargeIds()
  ids.add(id)
  localStorage.setItem(CHARGE_IDS_KEY, JSON.stringify([...ids]))
}
