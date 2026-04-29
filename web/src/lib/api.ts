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
  totalLitresSold: number
  totalSales: number
}
