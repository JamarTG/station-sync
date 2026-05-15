import axios from 'axios'

export const api = axios.create({ baseURL: '/v1' })

export interface Fuel {
  id: string
  name: string
}

export interface Pump {
  id: string
  name: string
  description: string
}

export interface Shift {
  id: string
  supervisor_id: string
  date: string
  start_time: string
  end_time: string
  created_at: string
}

export interface NozzleReading {
  nozzleNumber: number
  openingReading: number
  closingReading: number
}

export interface FuelSummary {
  fuelType: string
  nozzles: NozzleReading[]
  pricePerLitre: number
  totalLitresSold: number
  totalSales: number
}

export interface User {
  id: string
  name: string
  role: string
  active: boolean
  employed_on: string | null
  phone: string
  nis: string
  trn: string
  email: string
  pay_rate: number | null
  pay_type: 'Hourly' | 'Salary' | null
}

export interface PayrollPeriod {
  id: string
  start_date: string
  end_date: string
  status: 'Draft' | 'Published'
  created_at: string
}

export interface PayrollRecord {
  id: string
  period_id: string
  user_id: string
  user_name: string
  user_role: string
  gross_pay: number
  nis: number
  nht: number
  ed_tax: number
  paye: number
  net_pay: number
  hours_worked: number | null
  created_at: string
}
