/** Format a raw numeric string for display inside an input (adds thousand separators, preserves trailing dot/decimals). */
export function fmtInput(raw: string): string {
  if (!raw) return ''
  const stripped = raw.replace(/,/g, '')
  const [intStr, decStr] = stripped.split('.')
  const intNum = parseInt(intStr || '0', 10)
  if (isNaN(intNum)) return raw
  const formattedInt = intNum.toLocaleString('en-US')
  return decStr !== undefined ? `${formattedInt}.${decStr}` : formattedInt
}

/** Strip everything except digits and decimal point before storing as raw state. */
export function parseInput(value: string): string {
  return value.replace(/[^\d.]/g, '')
}

/** Format a number for display (2 decimal places, thousand separators). */
export function fmtNum(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
