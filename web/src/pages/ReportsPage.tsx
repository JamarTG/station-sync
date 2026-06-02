import { useEffect, useRef } from 'react'
import { ChevronRight } from 'lucide-react'

interface ReportLink {
  title: string
  description: string
  slug?: string
}

interface ReportSection {
  category: string
  description: string
  reports: ReportLink[]
}

const SECTIONS: ReportSection[] = [
  {
    category: 'Financial statements',
    description: 'Get a clear picture of how your business is doing. Use these core statements to better understand your financial health.',
    reports: [
      {
        title: 'Profit & Loss (Income Statement)',
        description: 'Shows your business\'s net profit and summarizes your revenues and expenses in a given time period.',
      },
      {
        title: 'Operating Expenses',
        description: 'A breakdown of day-to-day costs including wages, utilities, and supplies, helping you track where money is being spent.',
      },
      {
        title: 'Cash Flow',
        description: 'Shows how much money is entering and leaving your business. The cash flow statement tells you how much cash you have on hand for a specific time period.',
      },
    ],
  },
  {
    category: 'Taxes',
    description: 'A detailed look at the taxes you owe, based on sales taxes collected and paid, and transactions processed.',
    reports: [
      {
        title: 'Sales Tax Report',
        description: 'A breakdown of taxes collected from sales and paid on purchases. You can use this information to prepare sales tax returns and calculate your balance or refund.',
      },
    ],
  },
  {
    category: 'Customers',
    description: 'Identify your highest value customers, track late payers, and stay on top of deposits and other amounts due.',
    reports: [
      {
        title: 'Income by Customer',
        description: 'A breakdown of paid and unpaid income for every customer.',
      },
      {
        title: 'Aged Receivables',
        description: 'Unpaid and overdue invoices for the last 30, 60, and 90+ days.',
      },
    ],
  },
  {
    category: 'Fuel',
    description: 'Monitor fuel inventory, deliveries, and variance across your tanks and pumps.',
    reports: [
      {
        title: 'Fuel Stock Report',
        description: 'Opening and closing tank levels, deliveries received, and net variance for each fuel grade.',
      },
      {
        title: 'Fuel Sales by Grade',
        description: 'Litres sold and revenue per fuel grade across all shifts in a selected period.',
      },
      {
        title: 'Tank Dip Log',
        slug: 'tank-dip-log',
        description: 'Historical tank readings shift by shift, showing deliveries and consumption trends.',
      },
      {
        title: 'Wet Stock Report — Monthly',
        slug: 'wet-stock-monthly',
        description: 'Monthly reconciliation of fuel received, sold, and on hand across all tanks, with variance analysis.',
      },
      {
        title: 'Wet Stock Report — Quarterly',
        slug: 'wet-stock-quarterly',
        description: 'Quarterly wet stock summary aggregating monthly figures for compliance and trend reporting.',
      },
    ],
  },
  {
    category: 'Sales',
    description: 'Track revenue across your service station and convenience store, broken down by fuel type, staff, and payment method.',
    reports: [
      {
        title: 'Sales by Fuel Type',
        description: 'Revenue and litres sold for each fuel grade across all shifts.',
      },
      {
        title: 'Sales by Staff',
        description: 'Individual attendant performance ranked by total deposits collected.',
      },
      {
        title: 'Payment Method Breakdown',
        description: 'Split of cash, card, charge, FX, and advance payments for any period.',
      },
    ],
  },
  {
    category: 'Convenience Store',
    description: 'Track convenience store sales, inventory levels, and top-selling products.',
    reports: [
      {
        title: 'Sales Summary',
        description: 'Total convenience store revenue broken down by day, week, or month.',
      },
      {
        title: 'Sales by Product',
        description: 'Revenue and units sold per product, ranked by best performers.',
      },
      {
        title: 'Inventory Report',
        description: 'Current stock levels, low-stock alerts, and reorder recommendations for all products.',
      },
      {
        title: 'Shrinkage & Variance',
        description: 'Tracks discrepancies between expected and actual stock to identify losses or theft.',
      },
    ],
  },
  {
    category: 'Payroll',
    description: 'Review pay history, deductions, and net pay totals for your team.',
    reports: [
      {
        title: 'Payroll Summary',
        description: 'Gross pay, deductions (NIS, NHT, PAYE, Education Tax), and net pay per employee for a selected period.',
      },
      {
        title: 'S01 Remittance',
        description: 'NIS and NHT remittance report formatted for statutory filing.',
      },
    ],
  },
]

export function ReportsPage() {
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const highlightSlug = new URLSearchParams(window.location.search).get('report') ?? ''

  useEffect(() => {
    if (!highlightSlug) return
    const el = rowRefs.current[highlightSlug]
    if (el) {
      // Small delay so the page has rendered fully before scrolling
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120)
    }
  }, [highlightSlug])

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-[860px] mx-auto flex flex-col gap-6">
        <div>
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] dark:text-[#555] uppercase mb-1">Analytics</p>
          <h1 className="text-[28px] font-bold text-[#111] dark:text-[#e0e0e0] leading-tight">Reports</h1>
        </div>

        {SECTIONS.map((section) => (
          <div key={section.category} className="border border-[#e0e0e0] dark:border-[#2a2a2a] rounded-2xl overflow-hidden">
            <div className="flex">
              {/* Left: category info */}
              <div className="w-[260px] shrink-0 p-6 border-r border-[#e8e8e8] dark:border-[#222] bg-white dark:bg-[#1a1a1a]">
                <p className="text-[15px] font-bold text-[#111] dark:text-[#e0e0e0] mb-2">{section.category}</p>
                <p className="text-[13px] text-[#666] dark:text-[#888] leading-relaxed">{section.description}</p>
              </div>

              {/* Right: report links */}
              <div className="flex-1 min-w-0">
                {section.reports.map((report, i) => {
                  const isHighlighted = !!report.slug && report.slug === highlightSlug
                  return (
                    <button
                      key={report.title}
                      ref={(el) => { if (report.slug) rowRefs.current[report.slug] = el }}
                      className={`w-full text-left px-6 py-4 flex items-center gap-4 transition-colors ${
                        i < section.reports.length - 1 ? 'border-b border-[#f0f0f0] dark:border-[#1e1e1e]' : ''
                      } ${isHighlighted ? 'bg-[#f5f5f5] dark:bg-[#1e1e1e]' : 'hover:bg-[#f9f9f9] dark:hover:bg-[#1a1a1a]'}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[14px] font-semibold text-[#111] dark:text-[#e0e0e0]">{report.title}</p>
                          {isHighlighted && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-[#111] text-white rounded-full tracking-wide uppercase">
                              Selected
                            </span>
                          )}
                        </div>
                        <p className="text-[13px] text-[#666] dark:text-[#888] leading-relaxed">{report.description}</p>
                      </div>
                      <ChevronRight size={16} className="text-[#111] dark:text-[#e0e0e0] shrink-0" />
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
