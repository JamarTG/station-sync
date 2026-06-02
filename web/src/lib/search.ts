// ─────────────────────────────────────────────────────────────────────────────
// Multi-attribute, comma-separated search.
//
// A query is split on commas into independent terms. Every term must match
// (AND across terms); within a term, a match against ANY provided text field
// counts (OR across fields). A term that looks like a date or a date range is
// matched against the entry's date field instead of its text.
//
//   "war, anthony miller"            → text "war" AND text "anthony miller"
//   "2/3/2026 - 30/3/2026, anthony"  → date in range AND text "anthony"
//   "2/3/2026"                       → entry on that day
//
// Dates are parsed as day/month/year (Jamaican/European, e.g. 30/3/2026) and
// also accept ISO (2026-03-30).
// ─────────────────────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Parse a single date token in d/m/y, d-m-y, or ISO form. Returns null if not a date. */
function parseDate(token: string): Date | null {
  const s = token.trim()
  if (!s) return null

  // ISO: yyyy-mm-dd
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) {
    const [, y, m, d] = iso
    const date = new Date(Number(y), Number(m) - 1, Number(d))
    return isNaN(date.getTime()) ? null : startOfDay(date)
  }

  // Day/Month/Year: d/m/yyyy, dd-mm-yy, d.m.yyyy
  const dmy = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/)
  if (dmy) {
    let [, d, m, y] = dmy as unknown as [string, string, string, string]
    let year = Number(y)
    if (year < 100) year += 2000
    const date = new Date(year, Number(m) - 1, Number(d))
    return isNaN(date.getTime()) ? null : startOfDay(date)
  }
  return null
}

/** Coerce an arbitrary date-ish value to a local-midnight Date, or null. */
function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value == null || value === '') return null
  if (value instanceof Date) return isNaN(value.getTime()) ? null : startOfDay(value)
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : startOfDay(d)
}

type Term =
  | { kind: 'text'; value: string }
  | { kind: 'date'; on: Date }
  | { kind: 'range'; start: Date; end: Date }

/** Split a raw query into typed terms (text / single-date / date-range). */
export function parseSearchTerms(query: string): Term[] {
  return query
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .map<Term>((raw) => {
      // Date range: "A - B" (require spaces around the dash so "3-3-2026" is
      // still read as a single date, not a range).
      const rangeMatch = raw.split(/\s+-\s+|\s+–\s+|\s+to\s+/i)
      if (rangeMatch.length === 2) {
        const a = parseDate(rangeMatch[0])
        const b = parseDate(rangeMatch[1])
        if (a && b) {
          const [start, end] = a <= b ? [a, b] : [b, a]
          return { kind: 'range', start, end }
        }
      }
      const single = parseDate(raw)
      if (single) return { kind: 'date', on: single }
      return { kind: 'text', value: raw.toLowerCase() }
    })
}

export interface SearchFields {
  /** Text attributes to match text terms against. */
  text?: (string | null | undefined)[]
  /** Date attribute(s) to match date / date-range terms against. */
  date?: (string | number | Date | null | undefined) | (string | number | Date | null | undefined)[]
}

/**
 * Returns true if `entry` matches every comma-separated term in `query`.
 * Empty / whitespace query matches everything.
 */
export function matchesSearch(query: string, fields: SearchFields): boolean {
  const terms = parseSearchTerms(query)
  if (terms.length === 0) return true

  const haystack = (fields.text ?? [])
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .map((v) => v.toLowerCase())

  const rawDates = Array.isArray(fields.date) ? fields.date : [fields.date]
  const dates = rawDates.map(toDate).filter((d): d is Date => d != null)

  return terms.every((term) => {
    switch (term.kind) {
      case 'text':
        return haystack.some((h) => h.includes(term.value))
      case 'date':
        return dates.some((d) => d.getTime() === term.on.getTime())
      case 'range':
        return dates.some((d) => d >= term.start && d <= term.end)
    }
  })
}
