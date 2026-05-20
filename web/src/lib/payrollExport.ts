import type { PayrollRecord, PayrollPeriod, User } from './api'

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-JM', { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtMoney(n: number) {
  return n.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── CSV download helper ───────────────────────────────────────────────────────

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Print helper ──────────────────────────────────────────────────────────────

function printHTML(html: string) {
  const win = window.open('', '_blank', 'width=800,height=600')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 300)
}

const printStyles = `
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; margin: 0; padding: 24px; }
  h1   { font-size: 18px; margin: 0 0 4px; }
  h2   { font-size: 14px; margin: 16px 0 8px; }
  p    { margin: 2px 0; color: #555; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th  { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; border-bottom: 2px solid #111; padding: 4px 8px; }
  td  { padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 12px; }
  .right { text-align: right; }
  .total td { font-weight: bold; border-top: 2px solid #111; border-bottom: none; }
  .meta { display: flex; gap: 32px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #eee; }
  .meta div { }
  .meta .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; }
  .meta .value { font-size: 13px; font-weight: bold; }
  @media print { body { padding: 0; } }
`

// ── Pay Slip ──────────────────────────────────────────────────────────────────

export function printPaySlip(record: PayrollRecord, stationName = 'Service Station') {
  const totalDeductions = record.nis + record.nht + record.ed_tax + record.paye

  printHTML(`<!DOCTYPE html><html><head><title>Pay Slip</title><style>${printStyles}</style></head><body>
    <h1>${stationName}</h1>
    <p>Pay Slip</p>
    <div class="meta">
      <div><div class="label">Employee</div><div class="value">${record.user_name}</div></div>
      <div><div class="label">Role</div><div class="value">${record.user_role}</div></div>
      <div><div class="label">Period</div><div class="value">${fmtDate(record.period_start_date)} – ${fmtDate(record.period_end_date)}</div></div>
      <div><div class="label">Status</div><div class="value">${record.period_status}</div></div>
    </div>
    <table>
      <tr><th>Description</th><th class="right">Amount (JMD)</th></tr>
      <tr><td>Gross Pay</td><td class="right">${fmtMoney(record.gross_pay)}</td></tr>
      ${record.hours_worked != null ? `<tr><td style="color:#888;font-size:11px">Hours Worked</td><td class="right" style="color:#888;font-size:11px">${record.hours_worked.toFixed(2)} hrs</td></tr>` : ''}
      <tr><td colspan="2" style="padding-top:8px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.05em">Deductions</td></tr>
      <tr><td>NIS (Employee 3%)</td><td class="right">(${fmtMoney(record.nis)})</td></tr>
      <tr><td>NHT (Employee 2%)</td><td class="right">(${fmtMoney(record.nht)})</td></tr>
      <tr><td>Education Tax (Employee 2.25%)</td><td class="right">(${fmtMoney(record.ed_tax)})</td></tr>
      <tr><td>PAYE</td><td class="right">(${fmtMoney(record.paye)})</td></tr>
      <tr><td>Total Deductions</td><td class="right">(${fmtMoney(totalDeductions)})</td></tr>
      <tr class="total"><td>Net Pay</td><td class="right">${fmtMoney(record.net_pay)}</td></tr>
    </table>
    <p style="margin-top:24px;font-size:10px;color:#bbb">Generated ${new Date().toLocaleString('en-JM')} · NIS, NHT, Education Tax and PAYE deducted as required by Jamaican law.</p>
  </body></html>`)
}

// ── Job Letter ────────────────────────────────────────────────────────────────

export function printJobLetter(user: User, stationName = 'Service Station') {
  const today = new Date().toLocaleDateString('en-JM', { year: 'numeric', month: 'long', day: 'numeric' })
  const employedSince = user.employed_on
    ? new Date(user.employed_on).toLocaleDateString('en-JM', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  printHTML(`<!DOCTYPE html><html><head><title>Job Letter</title><style>${printStyles}
    .letter { max-width: 600px; margin: 0 auto; }
    .letter p { font-size: 13px; color: #111; line-height: 1.7; margin: 12px 0; }
    .letter .date { color: #888; font-size: 12px; margin-bottom: 24px; }
    .letter .closing { margin-top: 48px; }
    .letter .sig-line { border-top: 1px solid #111; width: 200px; margin-top: 48px; padding-top: 4px; font-size: 11px; color: #888; }
  </style></head><body>
    <div class="letter">
      <h1>${stationName}</h1>
      <p class="date">${today}</p>
      <p><strong>To Whom It May Concern,</strong></p>
      <p>
        This letter is to certify that <strong>${user.name}</strong> is currently employed at
        <strong>${stationName}</strong> in the capacity of <strong>${user.role}</strong>.
        ${employedSince ? `${user.name.split(' ')[0]} has been employed with us since <strong>${employedSince}</strong>.` : ''}
      </p>
      <p>
        ${user.name.split(' ')[0]} is a ${user.active ? 'current and active' : 'former'} member of our team and
        this letter is issued at ${user.name.split(' ')[0]}'s request for whatever purpose it may serve.
      </p>
      <p class="closing">Yours faithfully,</p>
      <div class="sig-line">Authorised Signatory · ${stationName}</div>
    </div>
  </body></html>`)
}

// ── Payroll Register ──────────────────────────────────────────────────────────

export function printPayrollRegister(period: PayrollPeriod, records: PayrollRecord[], stationName = 'Service Station') {
  const totalGross = records.reduce((s, r) => s + r.gross_pay, 0)
  const totalNIS   = records.reduce((s, r) => s + r.nis, 0)
  const totalNHT   = records.reduce((s, r) => s + r.nht, 0)
  const totalEdTax = records.reduce((s, r) => s + r.ed_tax, 0)
  const totalPAYE  = records.reduce((s, r) => s + r.paye, 0)
  const totalNet   = records.reduce((s, r) => s + r.net_pay, 0)

  const rows = records.map((r) => `
    <tr>
      <td>${r.user_name}</td>
      <td>${r.user_role}</td>
      <td class="right">${fmtMoney(r.gross_pay)}</td>
      <td class="right">(${fmtMoney(r.nis)})</td>
      <td class="right">(${fmtMoney(r.nht)})</td>
      <td class="right">(${fmtMoney(r.ed_tax)})</td>
      <td class="right">(${fmtMoney(r.paye)})</td>
      <td class="right">${fmtMoney(r.net_pay)}</td>
    </tr>`).join('')

  printHTML(`<!DOCTYPE html><html><head><title>Payroll Register</title><style>${printStyles}</style></head><body>
    <h1>${stationName}</h1>
    <p>Payroll Register — ${fmtDate(period.start_date)} to ${fmtDate(period.end_date)}</p>
    <table style="margin-top:16px">
      <tr>
        <th>Employee</th><th>Role</th>
        <th class="right">Gross</th><th class="right">NIS</th><th class="right">NHT</th>
        <th class="right">Ed Tax</th><th class="right">PAYE</th><th class="right">Net Pay</th>
      </tr>
      ${rows}
      <tr class="total">
        <td colspan="2">TOTAL</td>
        <td class="right">${fmtMoney(totalGross)}</td>
        <td class="right">(${fmtMoney(totalNIS)})</td>
        <td class="right">(${fmtMoney(totalNHT)})</td>
        <td class="right">(${fmtMoney(totalEdTax)})</td>
        <td class="right">(${fmtMoney(totalPAYE)})</td>
        <td class="right">${fmtMoney(totalNet)}</td>
      </tr>
    </table>
    <p style="margin-top:24px;font-size:10px;color:#bbb">Generated ${new Date().toLocaleString('en-JM')}</p>
  </body></html>`)
}

// ── S01 Remittance CSV ────────────────────────────────────────────────────────
// For submission to Tax Administration Jamaica by the 14th of the following month

export function downloadS01CSV(period: PayrollPeriod, records: PayrollRecord[], users: User[]) {
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

  const header = [
    'Employee Name', 'TRN', 'NIS #',
    'Gross Pay', 'Taxable Income',
    'PAYE Withheld',
    'NIS Employee (3%)', 'NIS Employer (3%)', 'NIS Total',
    'NHT Employee (2%)', 'NHT Employer (3%)', 'NHT Total',
    'Education Tax Employee (2.25%)', 'Education Tax Employer (3.5%)', 'Education Tax Total',
  ]

  const dataRows = records.map((r) => {
    const u = userMap[r.user_id]
    const nisEmployer  = Math.round(r.gross_pay * 0.03 * 100) / 100
    const nhtEmployer  = Math.round(r.gross_pay * 0.03 * 100) / 100
    const edTaxEmployer = Math.round((r.gross_pay - r.nis) * 0.035 * 100) / 100
    const taxable = Math.max(r.gross_pay - 149948, 0)

    return [
      r.user_name,
      u?.trn ?? '',
      u?.nis ?? '',
      fmtMoney(r.gross_pay),
      fmtMoney(taxable),
      fmtMoney(r.paye),
      fmtMoney(r.nis),
      fmtMoney(nisEmployer),
      fmtMoney(r.nis + nisEmployer),
      fmtMoney(r.nht),
      fmtMoney(nhtEmployer),
      fmtMoney(r.nht + nhtEmployer),
      fmtMoney(r.ed_tax),
      fmtMoney(edTaxEmployer),
      fmtMoney(r.ed_tax + edTaxEmployer),
    ]
  })

  // Totals row
  const totals = (idx: number) => dataRows.reduce((s, r) => s + parseFloat(r[idx].replace(/,/g, '')), 0)
  const totalRow = [
    'TOTAL', '', '',
    fmtMoney(totals(3)), fmtMoney(totals(4)),
    fmtMoney(totals(5)),
    fmtMoney(totals(6)), fmtMoney(totals(7)), fmtMoney(totals(8)),
    fmtMoney(totals(9)), fmtMoney(totals(10)), fmtMoney(totals(11)),
    fmtMoney(totals(12)), fmtMoney(totals(13)), fmtMoney(totals(14)),
  ]

  const periodLabel = `${fmtDate(period.start_date)}_${fmtDate(period.end_date)}`.replace(/\s/g, '-')

  downloadCSV(`S01_Remittance_${periodLabel}.csv`, [header, ...dataRows, totalRow])
}

// ── HEART Levy CSV ────────────────────────────────────────────────────────────

export function downloadHeartCSV(period: PayrollPeriod, records: PayrollRecord[]) {
  const totalGross = records.reduce((s, r) => s + r.gross_pay, 0)
  const heartRate  = 0.03
  const heartLevy  = Math.round(totalGross * heartRate * 100) / 100
  const threshold  = 292300

  const header = ['Period', 'Total Gross Payroll', 'HEART Threshold', 'HEART Levy (3%)', 'Due Date']
  const dueDate = (() => {
    const d = new Date(period.end_date)
    d.setMonth(d.getMonth() + 1)
    d.setDate(14)
    return fmtDate(d.toISOString())
  })()

  const row = [
    `${fmtDate(period.start_date)} – ${fmtDate(period.end_date)}`,
    fmtMoney(totalGross),
    totalGross > threshold ? 'Exceeds threshold — levy applies' : 'Below threshold — levy may not apply',
    fmtMoney(heartLevy),
    dueDate,
  ]

  const periodLabel = `${fmtDate(period.start_date)}_${fmtDate(period.end_date)}`.replace(/\s/g, '-')
  downloadCSV(`HEART_Levy_${periodLabel}.csv`, [header, row])
}
