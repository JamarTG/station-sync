import { ChevronRight } from 'lucide-react'

interface ReportLink {
  title: string
  description: string
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
        description: 'Historical tank readings shift by shift, showing deliveries and consumption trends.',
      },
      {
        title: 'Wet Stock Report — Monthly',
        description: 'Monthly reconciliation of fuel received, sold, and on hand across all tanks, with variance analysis.',
      },
      {
        title: 'Wet Stock Report — Quarterly',
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
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-[860px] mx-auto flex flex-col gap-6">
        <div>
          <p className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase mb-1">Analytics</p>
          <h1 className="text-[28px] font-bold text-[#111] leading-tight">Reports</h1>
        </div>

        {SECTIONS.map((section) => (
          <div key={section.category} className="border border-[#e0e0e0] rounded-2xl overflow-hidden">
            <div className="flex">
              {/* Left: category info */}
              <div className="w-[260px] shrink-0 p-6 border-r border-[#e8e8e8] bg-white">
                <p className="text-[15px] font-bold text-[#111] mb-2">{section.category}</p>
                <p className="text-[13px] text-[#666] leading-relaxed">{section.description}</p>
              </div>

              {/* Right: report links */}
              <div className="flex-1 min-w-0">
                {section.reports.map((report, i) => (
                  <button
                    key={report.title}
                    className={`w-full text-left px-6 py-4 flex items-center gap-4 hover:bg-[#f9f9f9] transition-colors ${
                      i < section.reports.length - 1 ? 'border-b border-[#f0f0f0]' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-[#111] mb-1">{report.title}</p>
                      <p className="text-[13px] text-[#666] leading-relaxed">{report.description}</p>
                    </div>
                    <ChevronRight size={16} className="text-[#111] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
