import axios from 'axios'

export const api = axios.create({ baseURL: '/v1' })

let _on401: (() => void) | null = null
export function setUnauthorizedHandler(fn: () => void) {
  _on401 = fn
}

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && _on401) _on401()
    return Promise.reject(err)
  },
)

export interface AuthUser {
  id: string
  business_name?: string
  business_address_line1?: string
  business_address_line2?: string
  business_city?: string
  business_parish?: string
  branch_id: string | null
  name: string
  role: string
  email: string
  must_change_password?: boolean
  active?: boolean
  employed_on?: string | null
  phone?: string
  nis?: string
  trn?: string
  pay_rate?: number | null
  pay_type?: 'Hourly' | 'Salary' | null
  sick_days?: number | null
  latest_net_pay?: number | null
}

export type User = AuthUser

export interface Branch {
  id: string
  business_id: string
  name: string
  created_at: string
}

export interface Fuel {
  id: string
  name: string
}

export interface Pump {
  id: string
  branch_id: string
  name: string
  description: string
}

export interface Shift {
  id: string
  supervisor_id: string
  supervisor_name: string
  date: string
  start_time: string
  end_time: string | null
  created_at: string
  shift_type?: string
}

export interface Product {
  id: string
  business_id: string
  branch_id: string | null
  name: string
  category: string | null
  sku: string | null
  upc: string | null
  price: number
  cost: number | null
  stock_qty: number
  unit: string
  active: boolean
  created_at: string
}

export interface ShiftFuelPrice {
  fuel_id: string
  shift_id: string
  price: number
  fuel_name: string
}

export interface ShiftAttendance {
  id: string
  shift_id: string
  user_id: string
  user_name: string
  pump_id: string | null
  pump_name: string | null
  clock_in: string
  clock_out: string | null
  shift_date?: string
}

export interface Deposit {
  id: string
  shift_id: string
  attendant_id: string
  attendant_name: string
  type: string
  amount: number
  metadata: string | null
  created_at: string
}

export interface Nozzle {
  id: string
  pump_id: string
  fuel_id: string
  fuel_name: string
}

export interface Tank {
  id: string
  business_id: string
  branch_id: string
  fuel_id: string
  fuel_name: string
  name: string
  capacity_litres: number
}

export interface TankLog {
  id: string
  tank_id: string
  shift_id: string
  opening_level: number | null
  closing_level: number | null
  delivery_litres: number | null
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

export interface NozzleLog {
  id: string
  nozzle_id: string
  shift_id: string
  starting_reading: number
  ending_reading: number
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
  period_start_date: string
  period_end_date: string
  period_status: string
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
  overage: number
  shortage: number
  created_at: string
}

interface AuthResponse {
  token: string
  user: AuthUser
}

const TOKEN_KEY = 'ss_token'
const USER_KEY = 'ss_user'

function setToken(token: string) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  delete api.defaults.headers.common['Authorization']
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function saveUser(user: AuthUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function loadSavedSession(): { token: string; user: AuthUser } | null {
  const token = localStorage.getItem(TOKEN_KEY)
  const userRaw = localStorage.getItem(USER_KEY)
  if (!token || !userRaw) return null
  try {
    const user = JSON.parse(userRaw) as AuthUser
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    return { token, user }
  } catch {
    return null
  }
}

export function login(email: string, password: string) {
  return api.post<AuthResponse>('/auth/login', { email, password }).then((r) => {
    setToken(r.data.token)
    saveUser(r.data.user)
    return r.data.user
  })
}

export function signUp(data: { business_name: string; branch_name?: string; name: string; email: string; password: string; address_line1?: string; address_line2?: string; city?: string; parish?: string }) {
  return api.post<AuthResponse>('/auth/signup', data).then((r) => {
    setToken(r.data.token)
    saveUser(r.data.user)
    return r.data.user
  })
}

export function logout() {
  return api.post('/auth/logout').finally(clearToken)
}

export function getOpenShift() {
  return api
    .get<Shift>('/shifts/open')
    .then((r) => r.data)
}

export function getOpenCStoreShift() {
  return api
    .get<Shift>('/shifts/open/convenience')
    .then((r) => r.data)
    .catch((err) => {
      if (err.response?.status === 404) return null
      throw err
    })
}

export function getProducts() {
  return api.get<Product[]>('/products').then((r) => r.data)
}

export function getInactiveProducts() {
  return api.get<Product[]>('/products?active=false').then((r) => r.data)
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string | null
  name: string
  sku: string | null
  quantity: number
  unit_price: number
  discount: number
  total: number
  refunded: boolean
  created_at: string
}

export interface Order {
  id: string
  business_id: string
  branch_id: string | null
  shift_id: string | null
  cashier_id: string | null
  cashier_name: string
  customer_name: string | null
  order_no: number
  status: string
  payment_method: string | null
  subtotal: number
  discount: number
  tax: number
  total: number
  change_given: number | null
  note: string | null
  invoice_no: string | null
  created_at: string
  items?: OrderItem[]
}

export function getShiftOrders(shiftId: string) {
  return api.get<Order[]>(`/shifts/${shiftId}/orders`).then((r) => r.data)
}

export function updateOrderStatus(
  shiftId: string,
  orderId: string,
  status: string,
  paymentMethod?: string,
  changeGiven?: number
) {
  return api
    .patch<Order>(`/shifts/${shiftId}/orders/${orderId}`, {
      status,
      payment_method: paymentMethod,
      change_given: changeGiven,
    })
    .then((r) => r.data)
}

export function refundOrderItem(shiftId: string, orderId: string, itemId: string, refunded = true) {
  return api
    .patch<OrderItem>(`/shifts/${shiftId}/orders/${orderId}/items/${itemId}/refund`, { refunded })
    .then((r) => r.data)
}

export function deleteOrder(shiftId: string, orderId: string) {
  return api.delete(`/shifts/${shiftId}/orders/${orderId}`).then((r) => r.data)
}

export interface Customer {
  id: string
  business_id: string
  user_id: string | null
  name: string
  phone: string
  email: string
  credit_balance: number
  status: 'Active' | 'Inactive'
  created_at: string
}

export function getCustomers() {
  return api.get<Customer[]>('/customers').then((r) => r.data)
}

export function createCustomer(data: { name: string; phone?: string; email?: string }) {
  return api.post<Customer>('/customers', data).then((r) => r.data)
}

export function updateCustomer(
  id: string,
  data: { name?: string; phone?: string; email?: string; status?: string }
) {
  return api.patch<Customer>(`/customers/${id}`, data).then((r) => r.data)
}

export function getCustomerOrders(id: string) {
  return api.get<Order[]>(`/customers/${id}/orders`).then((r) => r.data)
}

export function createOrder(
  shiftId: string,
  data: {
    cashier_name: string
    customer_name?: string | null
    payment_method?: string | null
    subtotal: number
    discount: number
    tax: number
    total: number
    change_given?: number | null
    note?: string | null
    invoice_no?: string | null
    status: string
    items: {
      product_id?: string | null
      name: string
      sku?: string | null
      quantity: number
      unit_price: number
      discount: number
      total: number
    }[]
  }
) {
  return api.post<Order>(`/shifts/${shiftId}/orders`, data).then((r) => r.data)
}

export function createProduct(data: {
  name: string; category: string | null; sku: string | null; upc: string | null
  price: number; cost: number | null; stock_qty: number; unit: string
}) {
  return api.post<Product>('/products', data).then((r) => r.data)
}

export function updateProduct(id: string, data: {
  name: string; category: string | null; sku: string | null; upc: string | null
  price: number; cost: number | null; stock_qty: number; unit: string
}) {
  return api.patch<Product>(`/products/${id}`, data).then((r) => r.data)
}

export function setProductActive(id: string, active: boolean) {
  return api.patch<Product>(`/products/${id}`, { active }).then((r) => r.data)
}

export function deleteProduct(id: string) {
  return api.delete(`/products/${id}`).then((r) => r.data)
}

export function createShift(data: { supervisor_id: string; date: string; start_time: string }) {
  return api.post<Shift>('/shifts', data).then((r) => r.data)
}

export function createCStoreShift(data: { supervisor_id: string; date: string; start_time: string }) {
  return api.post<Shift>('/shifts', { ...data, shift_type: 'convenience_store' }).then((r) => r.data)
}

export function closeShift(shiftId: string) {
  return api.patch(`/shifts/${shiftId}/close`).then((r) => r.data)
}

export function getShiftFuelPrices(shiftId: string) {
  return api.get<ShiftFuelPrice[]>(`/shifts/${shiftId}/fuel-prices`).then((r) => r.data)
}

export function upsertFuelPrice(shiftId: string, fuelId: string, price: number) {
  return api.post(`/shifts/${shiftId}/fuel-prices`, { fuel_id: fuelId, price }).then((r) => r.data)
}

export function clockIn(shiftId: string, userId: string, pumpId?: string, clockInTime?: string) {
  return api
    .post(`/shifts/${shiftId}/attendance/clock-in`, {
      user_id: userId,
      pump_id: pumpId ?? null,
      clock_in: clockInTime ?? null,
    })
    .then((r) => r.data)
}

export function updateAttendance(
  shiftId: string,
  attendanceId: string,
  data: { user_id: string; pump_id?: string | null; clock_in?: string }
) {
  return api.patch<ShiftAttendance>(`/shifts/${shiftId}/attendance/${attendanceId}`, data).then((r) => r.data)
}

export function deleteAttendance(shiftId: string, attendanceId: string) {
  return api.delete(`/shifts/${shiftId}/attendance/${attendanceId}`).then((r) => r.data)
}

export function getShiftAttendance(shiftId: string) {
  return api.get<ShiftAttendance[]>(`/shifts/${shiftId}/attendance`).then((r) => r.data)
}

export function getShiftDeposits(shiftId: string) {
  return api.get<Deposit[]>(`/shifts/${shiftId}/deposits`).then((r) => r.data)
}

export function getUsers() {
  return api.get<AuthUser[]>('/users').then((r) => r.data)
}

export function getUserAttendance(userId: string) {
  return api.get<ShiftAttendance[]>(`/users/${userId}/attendance`).then((r) => r.data)
}

export function createUser(data: {
  name: string
  role: string
  password: string
  email: string
  phone?: string
  nis?: string
  trn?: string
  employed_on?: string
  date_of_birth?: string
}) {
  return api.post<AuthUser>('/users', data).then((r) => r.data)
}

export function updateUser(id: string, data: {
  name?: string
  role?: string
  email?: string
  phone?: string
  nis?: string
  trn?: string
  employed_on?: string
  date_of_birth?: string
  active?: boolean
  sick_days?: number | null
}) {
  return api.patch<AuthUser>(`/users/${id}`, data).then((r) => r.data)
}

export function changePassword(currentPassword: string, newPassword: string) {
  return api.patch('/users/me/password', { current_password: currentPassword, new_password: newPassword })
}

export function getBranches() {
  return api.get<Branch[]>('/branches').then((r) => r.data)
}

export function createBranch(name: string) {
  return api.post<Branch>('/branches', { name }).then((r) => r.data)
}

export function createFuel(data: { name: string }) {
  return api.post<Fuel>('/fuels', data).then((r) => r.data)
}

export function createPump(data: { name: string; description?: string }) {
  return api.post<Pump>('/pumps', data).then((r) => r.data)
}

export function getNozzles() {
  return api.get<Nozzle[]>('/nozzles').then((r) => r.data)
}

export function getPumpNozzles(pumpId: string) {
  return api.get<Nozzle[]>(`/pumps/${pumpId}/nozzles`).then((r) => r.data)
}

export function createNozzle(pumpId: string, fuelId: string) {
  return api.post(`/pumps/${pumpId}/nozzles`, { fuel_id: fuelId }).then((r) => r.data)
}

export function createDeposit(
  shiftId: string,
  data: { attendant_id: string; type: string; amount: number; metadata?: string | null }
) {
  return api.post<Deposit>(`/shifts/${shiftId}/deposits`, data).then((r) => r.data)
}

export function updateDeposit(
  shiftId: string,
  depositId: string,
  data: { attendant_id: string; type: string; amount: number; metadata?: string | null }
) {
  return api.patch<Deposit>(`/shifts/${shiftId}/deposits/${depositId}`, data).then((r) => r.data)
}

export function deleteDeposit(shiftId: string, depositId: string) {
  return api.delete(`/shifts/${shiftId}/deposits/${depositId}`).then((r) => r.data)
}

export function getTanks() {
  return api.get<Tank[]>('/tanks').then((r) => r.data)
}

export function getShiftTankLogs(shiftId: string) {
  return api.get<TankLog[]>(`/shifts/${shiftId}/tank-logs`).then((r) => r.data)
}

export function upsertNozzleLog(
  shiftId: string,
  data: { nozzle_id: string; starting_reading: number; ending_reading: number }
) {
  return api.post(`/shifts/${shiftId}/nozzle-logs`, { ...data, shift_id: shiftId }).then((r) => r.data)
}

export function getShiftNozzleLogs(shiftId: string) {
  return api.get<NozzleLog[]>(`/shifts/${shiftId}/nozzle-logs`).then((r) => r.data)
}

export function upsertTankLog(
  shiftId: string,
  data: { tank_id: string; opening_level?: number | null; closing_level?: number | null; delivery_litres?: number | null }
) {
  return api.post<TankLog>(`/shifts/${shiftId}/tank-logs`, data).then((r) => r.data)
}

export interface TimeOffRequest {
  id: string
  business_id: string
  user_id: string
  user_name: string
  date: string
  reason: string | null
  status: 'Pending' | 'Approved' | 'Rejected'
  reviewed_by: string | null
  reviewed_by_name: string | null
  reviewed_at: string | null
  created_at: string
}

export function getTimeOffRequests() {
  return api.get<TimeOffRequest[]>('/time-off-requests').then((r) => r.data)
}

export function createTimeOffRequest(data: { date: string; reason?: string }) {
  return api.post<TimeOffRequest>('/time-off-requests', data).then((r) => r.data)
}

export function reviewTimeOffRequest(id: string, action: 'approve' | 'reject') {
  return api.patch<TimeOffRequest>(`/time-off-requests/${id}/${action}`).then((r) => r.data)
}

export interface FuelReceival {
  id: string
  shift_id: string
  tank_id: string | null
  fuel_name: string
  litres_ordered: number
  opening_level: number | null
  closing_level: number | null
  rate: number | null
  haulage: number | null
  gct: number | null
  invoice_no: string | null
}

export function getShiftFuelReceivals(shiftId: string) {
  return api.get<FuelReceival[]>(`/shifts/${shiftId}/fuel-receivals`).then((r) => r.data)
}

export interface AccountSummary {
  id: string
  name: string
  user_count: number
  branch_count: number
  created_at: string
}

export function platformSignUp(data: { secret_key: string; name: string; email: string; password: string }) {
  return api.post<AuthResponse>('/auth/platform-signup', data).then((r) => {
    setToken(r.data.token)
    saveUser(r.data.user)
    return r.data.user
  })
}

export function getPlatformAccounts() {
  return api.get<AccountSummary[]>('/platform/accounts').then((r) => r.data)
}

export function createFuelReceival(
  shiftId: string,
  data: {
    tank_id?: string | null
    fuel_name: string
    litres_ordered: number
    opening_level?: number | null
    closing_level?: number | null
    rate?: number | null
    haulage?: number | null
    gct?: number | null
    invoice_no?: string | null
  }
) {
  return api.post<FuelReceival>(`/shifts/${shiftId}/fuel-receivals`, data).then((r) => r.data)
}
