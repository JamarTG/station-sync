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
  overtime_rate?: number | null
  sick_days?: number | null
  sick_days_used?: number | null
  latest_net_pay?: number | null
  deactivation_reason?: 'Suspension' | 'Vacation' | 'Termination' | 'Special Leave' | null
  reactivate_on?: string | null
  deactivation_note?: string | null
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

export interface FuelRanking {
  fuel_type: string
  total_litres: number
  total_sales: number
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
    .catch((err) => {
      if (err.response?.status === 404) return null
      throw err
    })
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
  customer_type?: string | null
  created_at: string
}

export function getCustomers(type?: string) {
  const url = type ? `/customers?type=${encodeURIComponent(type)}` : '/customers'
  return api.get<Customer[]>(url).then((r) => r.data)
}

export function createCustomer(data: { name: string; phone?: string; email?: string; customer_type?: string }) {
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

export function takeoverCStoreShift(shiftId: string, supervisorId: string) {
  return api.patch<Shift>(`/shifts/${shiftId}`, { supervisor_id: supervisorId }).then((r) => r.data)
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
  deactivation_reason?: 'Suspension' | 'Vacation' | 'Termination' | 'Special Leave' | null
  reactivate_on?: string | null
  deactivation_note?: string | null
  // When true, the server applies deactivation_reason / reactivate_on /
  // deactivation_note (allowing them to be cleared on reactivation).
  set_deactivation?: boolean
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

export interface Issue {
  id: string
  business_id: string
  branch_id: string | null
  reporter_id: string | null
  reporter_name: string
  category: string
  description: string
  status: 'Open' | 'In Progress' | 'Resolved'
  created_at: string
}

export function getIssues() {
  return api.get<Issue[]>('/issues').then((r) => r.data)
}

export function createIssue(data: { category: string; description: string }) {
  return api.post<Issue>('/issues', data).then((r) => r.data)
}

export function updateIssueStatus(id: string, status: string) {
  return api.patch<Issue>(`/issues/${id}/status`, { status }).then((r) => r.data)
}

// ─── SPS — Supervisor Performance Score ───────────────────────────────────────

export interface SPSShiftScore {
  id: string
  shift_id: string
  supervisor_id: string
  supervisor_name: string
  branch_id: string | null
  business_id: string
  score_sales: number
  score_cash_variance: number
  score_fuel_variance: number
  score_attendance: number
  score_team: number
  score_task_completion: number
  score_inventory: number
  score_incident: number
  score_safety: number
  score_customer_service: number
  total_penalties: number
  total_bonuses: number
  sps_shift_raw: number
  sps_shift_final: number
  sales_efficiency_ratio: number | null
  fuel_variance_pct: number | null
  attendant_count: number
  incident_count: number
  bonus_breakdown: string   // JSON array string
  penalty_breakdown: string // JSON array string
  scored_at: string
}

export interface SupervisorLifetimeStats {
  supervisor_id: string
  supervisor_name: string
  business_id: string
  total_shifts: number
  confidence_weight: number
  sps_raw_ewma: number
  sps_lifetime_final: number
  sps_peak: number
  current_tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Elite' | 'Legend'
  current_perfect_streak: number
  best_perfect_streak: number
  total_revenue_managed: number
  total_fuel_volume_litres: number
  last_computed_at: string
  global_rank: number
  company_rank: number
}

export interface RankingEntry {
  rank: number
  supervisor_id: string
  supervisor_name: string
  current_tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Elite' | 'Legend'
  sps_lifetime_final: number
  sps_raw_ewma: number
  sps_peak: number
  total_shifts: number
  confidence_weight: number
  current_perfect_streak: number
  best_perfect_streak: number
  total_revenue_managed: number
}

export function scoreShift(shiftId: string) {
  return api.post<SPSShiftScore>(`/shifts/${shiftId}/score`).then((r) => r.data)
}

export function getRankings(scope: 'company' | 'branch' = 'company') {
  return api.get<RankingEntry[]>(`/rankings?scope=${scope}`).then((r) => r.data)
}

export function getSupervisorSPS(userId: string) {
  return api
    .get<{ stats: SupervisorLifetimeStats; recent_scores: { shift_id: string; date: string; sps_final: number; scored_at: string }[] }>(`/users/${userId}/sps`)
    .then((r) => r.data)
}

export function getMySPS() {
  return api.get<SupervisorLifetimeStats>('/sps/me').then((r) => r.data)
}

// ─── Fuel Intelligence ────────────────────────────────────────────────────────

export interface FPSResult {
  business_id: string
  branch_id?: string
  period: string
  score_inventory_accuracy: number
  score_fuel_loss: number
  score_delivery_efficiency: number
  score_tank_utilization: number
  score_sales_performance: number
  score_compliance: number
  fps_total: number
  grade: string
  total_tanks_scored: number
  avg_variance_pct: number
  total_shrinkage_litres: number
  total_deliveries: number
  compliance_rate: number
}

export interface TankSummary {
  tank_id: string
  tank_name: string
  fuel_name: string
  capacity_litres: number
  current_level_litres: number
  current_pct: number
  ullage_litres: number
  inventory_status: 'critical' | 'low' | 'normal' | 'high'
  avg_variance_pct: number
  total_variance_litres: number
  variance_class: 'acceptable' | 'warning' | 'critical'
  shifts_analysed: number
  avg_utilization_pct: number
  avg_daily_usage_litres: number
  days_until_reorder: number
  days_until_empty: number
  reorder_point_litres: number
  reorder_suggested: boolean
  lead_time_days: number
  safety_stock_litres: number
  tank_fps: number
}

export interface GradeAnalytics {
  fuel_id: string
  fuel_name: string
  total_litres_sold: number
  avg_daily_litres: number
  total_litres_received: number
  inventory_turnover: number
  total_revenue: number
  total_cost: number
  gross_profit: number
  margin_pct: number
  profit_per_litre: number
  revenue_share_pct: number
  total_variance_litres: number
  shrinkage_pct: number
  revenue_growth_pct: number
  volume_growth_pct: number
}

export interface DeliveryRecord {
  id: string
  shift_id: string
  shift_date: string
  tank_id: string | null
  tank_name: string
  fuel_name: string
  supplier_name: string
  invoice_no: string
  litres_ordered: number
  litres_measured: number
  delivery_variance: number
  accuracy_pct: number
  accuracy_class: 'accurate' | 'short' | 'surplus'
  cost_per_litre: number
  total_cost: number
}

export interface DeliverySummary {
  total_deliveries: number
  total_litres_ordered: number
  total_litres_measured: number
  overall_accuracy_pct: number
  short_deliveries: number
  surplus_deliveries: number
  total_shortfall_litres: number
  avg_cost_per_litre: number
  records: DeliveryRecord[]
}

export interface ReorderStatus {
  tank_id: string
  tank_name: string
  fuel_name: string
  current_litres: number
  capacity_litres: number
  avg_daily_usage_litres: number
  lead_time_days: number
  safety_stock_litres: number
  reorder_point_litres: number
  reorder_qty_litres: number
  days_until_reorder: number
  days_until_empty: number
  urgency: 'normal' | 'soon' | 'urgent' | 'critical'
  reorder_suggested: boolean
}

export interface FuelAlert {
  id: string
  business_id: string
  branch_id: string | null
  tank_id: string | null
  tank_name: string
  shift_id: string | null
  alert_type: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  value: number | null
  threshold: number | null
  resolved: boolean
  resolved_at: string | null
  created_at: string
}

export function getFuelFPS() {
  return api.get<FPSResult>('/fuel/fps').then((r) => r.data)
}

export function getFuelTanksSummary() {
  return api.get<TankSummary[]>('/fuel/tanks/summary').then((r) => r.data)
}

export function getFuelGradeAnalytics() {
  return api.get<GradeAnalytics[]>('/fuel/grades/analytics').then((r) => r.data)
}

export function getFuelDeliverySummary() {
  return api.get<DeliverySummary>('/fuel/deliveries/summary').then((r) => r.data)
}

export function getFuelReorderStatus() {
  return api.get<ReorderStatus[]>('/fuel/reorder').then((r) => r.data)
}

export function getFuelAlerts(resolved?: boolean) {
  const q = resolved !== undefined ? `?resolved=${resolved}` : ''
  return api.get<FuelAlert[]>(`/fuel/alerts${q}`).then((r) => r.data)
}

export function resolveFuelAlert(alertId: string) {
  return api.patch<FuelAlert>(`/fuel/alerts/${alertId}/resolve`).then((r) => r.data)
}

export function checkFuelAlerts() {
  return api.post('/fuel/alerts/check').then((r) => r.data)
}

// ─── Payroll v2 ───────────────────────────────────────────────────────────────

export type PayFrequency = 'Weekly' | 'BiWeekly' | 'Fortnightly' | 'SemiMonthly' | 'Monthly'
export const PAY_FREQUENCIES: PayFrequency[] = ['Weekly', 'BiWeekly', 'Fortnightly', 'SemiMonthly', 'Monthly']

/** Periods per year for each frequency */
export const FREQUENCY_PERIODS: Record<PayFrequency, number> = {
  Weekly: 52, BiWeekly: 26, Fortnightly: 26, SemiMonthly: 24, Monthly: 12,
}

export interface PayrollConfig {
  id?: string
  business_id: string
  frequency: PayFrequency
  pay_day: number | null
  currency: string
  /**
   * Standard overtime multiplier.
   * Formula: OvertimePay = OvertimeHours × HourlyRate × overtimeMultiplier
   * JA default: 1.5 (time and a half — LRIDA standard weekday overtime)
   */
  overtime_multiplier: number
  /**
   * Double-time multiplier for public holidays / contractual rest day.
   * JA default: 2.0
   */
  double_time_multiplier: number
  created_at?: string
  updated_at?: string
}

export interface TaxRuleSet {
  id: string
  business_id: string
  name: string
  effective_from: string
  effective_to: string | null
  is_active: boolean
  created_at: string
  rules?: TaxRule[]
}

export interface TaxRule {
  id: string
  rule_set_id: string
  /** NIS | NHT | EDTAX | PAYE_L1 | PAYE_L2 */
  tax_type: string
  /** e.g. 0.03 */
  rate: number
  /** Annual income threshold (PAYE) */
  threshold: number | null
  /** Annual upper bracket (PAYE_L1 upper / PAYE_L2 lower) */
  upper_limit: number | null
  /** NIS insurable earnings ceiling (annual) */
  annual_cap: number | null
  basis: 'gross' | 'statutory' | 'taxable'
  applies_to: 'employee' | 'employer' | 'both'
  created_at: string
}

export interface EmployeeCompensation {
  id: string
  business_id: string
  user_id: string
  user_name?: string
  user_role?: string
  effective_from: string
  effective_to: string | null
  frequency: PayFrequency
  pay_type: 'Salary' | 'Hourly'
  entered_amount: number
  is_after_tax: boolean
  annual_gross: number
  monthly_gross: number
  weekly_gross: number
  daily_rate: number
  hourly_rate: number
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface SalaryPreview {
  entered_amount: number
  frequency: PayFrequency
  is_after_tax: boolean
  // Gross equivalents
  annual_gross: number
  monthly_gross: number
  weekly_gross: number
  daily_rate: number
  hourly_rate: number
  // Monthly deductions
  nis_employee: number
  nht_employee: number
  edtax_employee: number
  paye: number
  net_pay: number
  effective_rate_pct: number
  // Employer monthly cost
  nis_employer: number
  nht_employer: number
  edtax_employer: number
  total_employer_cost: number
  // Reverse-calc result (only when is_after_tax = true)
  required_gross?: number
}

export type PayrollRunStatus = 'Draft' | 'Calculated' | 'Approved' | 'Locked' | 'Paid' | 'Cancelled'

export interface PayrollRun {
  id: string
  business_id: string
  period_id: string | null
  tax_rule_set_id: string | null
  label: string
  frequency: PayFrequency
  status: PayrollRunStatus
  total_gross: number
  total_deductions: number
  total_net: number
  total_employer_cost: number
  employee_count: number
  notes: string | null
  approved_by: string | null
  approved_at: string | null
  locked_by: string | null
  locked_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  period_start?: string | null
  period_end?: string | null
}

export interface PayrollRunLine {
  id: string
  run_id: string
  user_id: string
  user_name: string
  compensation_id: string | null
  base_gross: number
  overtime_hours: number
  overtime_pay: number
  bonus: number
  other_earnings: number
  total_gross: number
  nis_employee: number
  nht_employee: number
  edtax_employee: number
  paye: number
  nis_employer: number
  nht_employer: number
  edtax_employer: number
  other_deductions: number
  total_deductions: number
  net_pay: number
  employer_cost: number
  is_overridden: boolean
  override_reason: string | null
  created_at: string
  updated_at: string
}

export interface PayrollAuditEntry {
  id: string
  entity_type: string
  entity_id: string
  action: string
  actor_id: string | null
  actor_name: string
  before_val: unknown
  after_val: unknown
  reason: string | null
  created_at: string
}

export interface PayrollAnalytics {
  monthly_costs: { month: string; total_gross: number; total_net: number; employee_count: number }[]
  total_gross: number
  total_net: number
  total_nis: number
  total_nht: number
  total_edtax: number
  total_paye: number
  total_employer_cost: number
  avg_salary: number
  head_count: number
  labor_cost_pct: number
}

// ── API functions ─────────────────────────────────────────────────────────────

export function getPayrollConfig() {
  return api.get<PayrollConfig>('/payroll/config').then((r) => r.data)
}
export function upsertPayrollConfig(data: Partial<PayrollConfig>) {
  return api.put<PayrollConfig>('/payroll/config', data).then((r) => r.data)
}

export function getTaxRuleSets() {
  return api.get<TaxRuleSet[]>('/payroll/tax-rule-sets').then((r) => r.data)
}
export function createTaxRuleSet(data: { name: string; effective_from: string }) {
  return api.post<TaxRuleSet>('/payroll/tax-rule-sets', data).then((r) => r.data)
}
export function activateTaxRuleSet(id: string) {
  return api.patch<TaxRuleSet>(`/payroll/tax-rule-sets/${id}/activate`).then((r) => r.data)
}
export function getTaxRules(ruleSetId: string) {
  return api.get<TaxRule[]>(`/payroll/tax-rule-sets/${ruleSetId}/rules`).then((r) => r.data)
}
export function upsertTaxRule(ruleSetId: string, data: Partial<TaxRule>) {
  return api.put<TaxRule>(`/payroll/tax-rule-sets/${ruleSetId}/rules`, data).then((r) => r.data)
}

export function previewSalary(data: {
  entered_amount: number
  frequency: PayFrequency
  is_after_tax: boolean
  pay_type?: string
}) {
  return api.post<SalaryPreview>('/payroll/salary-preview', data).then((r) => r.data)
}

export function getCompensation() {
  return api.get<EmployeeCompensation[]>('/payroll/compensation').then((r) => r.data)
}
export function upsertCompensation(userId: string, data: {
  frequency: PayFrequency
  pay_type: string
  entered_amount: number
  is_after_tax: boolean
  effective_from: string
  effective_to?: string | null
  notes?: string | null
}) {
  return api.put<EmployeeCompensation>(`/payroll/compensation/${userId}`, data).then((r) => r.data)
}

export function getPayrollRuns() {
  return api.get<PayrollRun[]>('/payroll/runs').then((r) => r.data)
}
export function createPayrollRun(data: {
  label?: string
  frequency?: PayFrequency
  period_id?: string | null
  user_ids?: string[]
}) {
  return api.post<PayrollRun>('/payroll/runs', data).then((r) => r.data)
}
export function getPayrollRun(id: string) {
  return api.get<PayrollRun>(`/payroll/runs/${id}`).then((r) => r.data)
}
export function approvePayrollRun(id: string) {
  return api.patch<{ status: string }>(`/payroll/runs/${id}/approve`).then((r) => r.data)
}
export function lockPayrollRun(id: string) {
  return api.patch<{ status: string }>(`/payroll/runs/${id}/lock`).then((r) => r.data)
}
export function getPayrollRunLines(runId: string) {
  return api.get<PayrollRunLine[]>(`/payroll/runs/${runId}/lines`).then((r) => r.data)
}
export function overrideRunLine(runId: string, lineId: string, data: {
  bonus?: number
  /** Omit to let the server auto-compute: OvertimeHours × HourlyRate × OvertimeMultiplier */
  overtime_pay?: number
  overtime_hours?: number
  other_earnings?: number
  other_deductions?: number
  override_reason?: string
}) {
  return api.patch<PayrollRunLine>(`/payroll/runs/${runId}/lines/${lineId}`, data).then((r) => r.data)
}

export function getPayrollAnalytics() {
  return api.get<PayrollAnalytics>('/payroll/analytics').then((r) => r.data)
}
export function getPayrollAuditLog() {
  return api.get<PayrollAuditEntry[]>('/payroll/audit-log').then((r) => r.data)
}

// ─── CPS — Cashier Performance Score ─────────────────────────────────────────
//
// 100-point scoring system:
//   Cash Accuracy 25 | Transaction Quality 20 | Sales Effectiveness 20
//   Attendance 15 | Customer Service 10 | Compliance 5 | Team 5
//
// Normalisation: Sales score uses SER = employee_SPT / station_7day_avg_SPT
// Lifetime: EWMA(α=0.06) + CW(n) = n/(n+40) Bayesian shrinkage

export type EmployeeTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Elite' | 'Master' | 'Legend'

export interface CPSShiftScore {
  id: string
  shift_id: string
  cashier_id: string
  cashier_name: string
  business_id: string
  branch_id: string | null
  // Component scores
  score_cash_accuracy: number       // max 25
  score_transaction_quality: number // max 20
  score_sales_effectiveness: number // max 20
  score_attendance: number          // max 15
  score_customer_service: number    // max 10
  score_compliance: number          // max  5
  score_team: number                // max  5
  // Adjustments
  total_bonuses: number
  total_penalties: number
  bonus_breakdown: string   // JSON array
  penalty_breakdown: string // JSON array
  cps_shift_raw: number
  cps_shift_final: number
  // Supporting metrics
  cash_variance_amt: number | null
  cash_variance_pct: number | null
  total_transactions: number
  void_count: number
  refund_count: number
  total_sales: number
  sales_efficiency_ratio: number | null
  scored_at: string
}

export interface CashierLifetimeStats {
  cashier_id: string
  cashier_name: string
  business_id: string
  total_shifts: number
  /** CW(n) = n / (n + 40) — guards against small-sample gaming */
  confidence_weight: number
  cps_raw_ewma: number
  cps_lifetime_final: number
  cps_peak: number
  current_tier: EmployeeTier
  current_perfect_streak: number
  best_perfect_streak: number
  total_revenue_processed: number
  last_computed_at: string
  company_rank: number
  global_rank: number
}

// ─── APS — Attendant Performance Score ───────────────────────────────────────
//
// 100-point scoring system:
//   Fuel Accountability 25 | Forecourt Ops 20 | Productivity 20
//   Attendance 15 | Customer Service 10 | Safety 7 | Team 3
//
// Normalisation: Productivity uses ratio = employee_VPH / station_7day_avg_VPH
//   Score of 10 = at station average (fair regardless of station size)
//   Score of 20 = 2× average (max)

export interface APSShiftScore {
  id: string
  shift_id: string
  attendant_id: string
  attendant_name: string
  business_id: string
  branch_id: string | null
  // Component scores
  score_fuel_accountability: number // max 25
  score_forecourt_ops: number       // max 20
  score_productivity: number        // max 20
  score_attendance: number          // max 15
  score_customer_service: number    // max 10
  score_safety: number              // max  7
  score_team: number                // max  3
  // Adjustments
  total_bonuses: number
  total_penalties: number
  bonus_breakdown: string
  penalty_breakdown: string
  aps_shift_raw: number
  aps_shift_final: number
  // Supporting metrics
  fuel_variance_pct: number | null
  vehicles_served: number
  fuel_volume_litres: number
  productivity_ratio: number | null
  safety_checks_completed: number
  safety_checks_required: number
  hazard_reports: number
  incident_count: number
  scored_at: string
}

export interface AttendantLifetimeStats {
  attendant_id: string
  attendant_name: string
  business_id: string
  total_shifts: number
  confidence_weight: number
  aps_raw_ewma: number
  aps_lifetime_final: number
  aps_peak: number
  current_tier: EmployeeTier
  current_perfect_streak: number
  best_perfect_streak: number
  total_fuel_dispensed_litres: number
  total_vehicles_served: number
  last_computed_at: string
  company_rank: number
  global_rank: number
}

export interface EmployeeRankingEntry {
  rank: number
  employee_id: string
  employee_name: string
  role: string
  current_tier: EmployeeTier
  lifetime_final: number
  raw_ewma: number
  peak: number
  total_shifts: number
  confidence_weight: number
  current_perfect_streak: number
  best_perfect_streak: number
}

export interface EmployeeFeedback {
  id: string
  business_id: string
  shift_id: string | null
  employee_id: string
  submitted_by: string | null
  /** positive | negative | neutral | complaint | commendation */
  feedback_type: string
  /** customer | peer | supervisor | mystery_shopper */
  source: string
  score: number   // 1-5
  notes: string | null
  resolved: boolean
  created_at: string
}

export interface CoachingInsight {
  employee_id: string
  period: string
  score_delta: number
  strengths: string[]
  improvements: string[]
  actions: string[]
  comparisons: string[]
  summary: string
  generated_at: string
}

export type RankingPeriod = 'alltime' | 'monthly' | 'quarterly' | 'annual'
export type RankingScope  = 'company' | 'branch'

export function getCPSRankings(scope: RankingScope = 'company', period: RankingPeriod = 'alltime') {
  return api.get<EmployeeRankingEntry[]>(`/cps/rankings?scope=${scope}&period=${period}`).then((r) => r.data)
}
export function getAPSRankings(scope: RankingScope = 'company', period: RankingPeriod = 'alltime') {
  return api.get<EmployeeRankingEntry[]>(`/aps/rankings?scope=${scope}&period=${period}`).then((r) => r.data)
}
export function getCashierStats(userId: string) {
  return api.get<{ stats: CashierLifetimeStats; recent_scores: CPSShiftScore[]; coaching: CoachingInsight }>(`/users/${userId}/cps`).then((r) => r.data)
}
export function getAttendantStats(userId: string) {
  return api.get<{ stats: AttendantLifetimeStats }>(`/users/${userId}/aps`).then((r) => r.data)
}
export function getCPSTierDistribution() {
  return api.get<Record<string, number>>('/cps/tier-distribution').then((r) => r.data)
}
export function getAPSTierDistribution() {
  return api.get<Record<string, number>>('/aps/tier-distribution').then((r) => r.data)
}
export function submitEmployeeFeedback(employeeId: string, data: {
  shift_id?: string
  feedback_type: string
  source?: string
  score?: number
  notes?: string
}) {
  return api.post<EmployeeFeedback>(`/employees/${employeeId}/feedback`, data).then((r) => r.data)
}

// ─── Holiday Management & Premium Pay ────────────────────────────────────────
//
// Variable holidays (Ash Wednesday, Good Friday, Easter Monday, Heroes Day) are
// resolved server-side via the Computus algorithm — the client only consumes
// concrete resolved dates.

export type HolidayType = 'public' | 'observed' | 'company' | 'emergency'
export type HolidayCategory = 'fixed' | 'variable' | 'declared'

export interface ResolvedHoliday {
  name: string
  date: string                 // YYYY-MM-DD gazetted date
  observed_date: string | null // shifted date if it fell on a weekend
  holiday_type: HolidayType
  category: HolidayCategory
  rule_key: string
  weekday: string
  is_weekend: boolean
}

export interface Holiday {
  id: string
  business_id: string | null   // null = national
  name: string
  holiday_date: string | null
  holiday_type: HolidayType
  category: HolidayCategory
  rule_key: string | null
  month_of: number | null
  day_of: number | null
  government_source: string | null
  is_recurring: boolean
  observed_rule: 'none' | 'next_monday' | 'nearest_weekday'
  effective_date: string
  expiry_date: string | null
  active: boolean
  created_by: string | null
  created_at: string
}

export interface HolidayPayRules {
  id?: string
  business_id: string
  /** Worked-holiday base rate. Pay = hours × H × multiplier. JA default 2.0 */
  regular_multiplier: number
  /** OT on a holiday. JA default 2.5 */
  overtime_multiplier: number
  /** Holiday on contractual rest day. JA default 2.5 */
  rest_day_multiplier: number
  /** Holiday night shift. JA default 2.25 */
  night_shift_multiplier: number
  /** Policy for employees who don't work the holiday */
  absent_policy: 'paid' | 'unpaid' | 'partial'
  absent_partial_pct: number
  night_shift_start: number
  night_shift_end: number
  created_at?: string
  updated_at?: string
}

export interface HolidayPayResult {
  holiday_name: string
  holiday_date: string
  base_hourly_rate: number
  regular_hours: number
  overtime_hours: number
  night_hours: number
  is_rest_day: boolean
  regular_pay: number
  holiday_premium: number
  holiday_overtime: number
  night_premium: number
  holiday_total: number
  multiplier_used: number
}

export interface HolidayShiftSignup {
  id: string
  business_id: string
  branch_id: string | null
  holiday_id: string | null
  holiday_date: string
  user_id: string
  user_name: string
  assignment: 'voluntary' | 'mandatory' | 'swap'
  status: 'requested' | 'approved' | 'rejected' | 'cancelled'
  swap_with: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export interface HolidayForecast {
  holiday_name: string
  holiday_date: string
  branch_id: string | null
  branch_name: string
  scheduled_staff: number
  forecast_demand: number
  staffing_gap: number
  is_understaffed: boolean
  est_regular_cost: number
  est_premium_cost: number
  est_overtime_cost: number
  est_total_labor_cost: number
}

export interface HolidayAnalytics {
  holiday_name: string
  holiday_date: string
  total_labor_cost: number
  premium_cost: number
  overtime_cost: number
  staff_worked: number
  staff_scheduled: number
  attendance_rate: number
  total_revenue: number
  revenue_vs_labor_pct: number
  vs_normal_day_pct: number
}

export interface HolidayComplianceAlert {
  id: string
  holiday_date: string
  holiday_name: string
  alert_type: 'underpaid' | 'missing_premium' | 'unpaid_absence' | 'understaffed'
  severity: 'info' | 'warning' | 'critical'
  employee_id: string | null
  employee_name: string
  message: string
  expected_pay: number | null
  actual_pay: number | null
}

export interface HolidayInsight {
  period: string
  headlines: string[]
  projections: string[]
  warnings: string[]
  generated_at: string
}

// ── API functions ──────────────────────────────────────────────────────────────

export function getHolidayCalendar(year: number) {
  return api.get<{ year: number; holidays: ResolvedHoliday[] }>(`/holidays/calendar?year=${year}`).then((r) => r.data)
}
export function getUpcomingHolidays(days = 90) {
  return api.get<ResolvedHoliday[]>(`/holidays/upcoming?days=${days}`).then((r) => r.data)
}
export function listHolidays() {
  return api.get<Holiday[]>('/holidays').then((r) => r.data)
}
export function createHoliday(data: {
  name: string
  holiday_date?: string
  holiday_type?: HolidayType
  category?: HolidayCategory
  month_of?: number
  day_of?: number
  government_source?: string
  is_recurring?: boolean
  observed_rule?: string
  expiry_date?: string
}) {
  return api.post<Holiday>('/holidays', data).then((r) => r.data)
}
export function deleteHoliday(id: string) {
  return api.delete(`/holidays/${id}`).then((r) => r.data)
}
export function getHolidayPayRules() {
  return api.get<HolidayPayRules>('/holidays/pay-rules').then((r) => r.data)
}
export function upsertHolidayPayRules(data: Partial<HolidayPayRules>) {
  return api.put<HolidayPayRules>('/holidays/pay-rules', data).then((r) => r.data)
}
export function previewHolidayPay(data: {
  holiday_name?: string
  holiday_date?: string
  base_hourly: number
  regular_hours?: number
  overtime_hours?: number
  night_hours?: number
  is_rest_day?: boolean
}) {
  return api.post<HolidayPayResult>('/holidays/pay-preview', data).then((r) => r.data)
}
export function getHolidaySignups(date?: string) {
  const q = date ? `?date=${date}` : ''
  return api.get<HolidayShiftSignup[]>(`/holidays/signups${q}`).then((r) => r.data)
}
export function createHolidaySignup(data: {
  holiday_id?: string
  holiday_date: string
  user_id?: string
  user_name?: string
  assignment?: 'voluntary' | 'mandatory' | 'swap'
  swap_with?: string
}) {
  return api.post<HolidayShiftSignup>('/holidays/signups', data).then((r) => r.data)
}
export function reviewHolidaySignup(id: string, status: 'approved' | 'rejected' | 'cancelled') {
  return api.patch<HolidayShiftSignup>(`/holidays/signups/${id}`, { status }).then((r) => r.data)
}
export function getHolidayForecast(date: string) {
  return api.get<{ holiday_name: string; date: string; forecasts: HolidayForecast[] }>(`/holidays/forecast?date=${date}`).then((r) => r.data)
}
export function getHolidayAnalytics(year: number) {
  return api.get<HolidayAnalytics[]>(`/holidays/analytics?year=${year}`).then((r) => r.data)
}
export function getHolidayCompliance(year: number) {
  return api.get<HolidayComplianceAlert[]>(`/holidays/compliance?year=${year}`).then((r) => r.data)
}
export function getHolidayInsights() {
  return api.get<HolidayInsight>('/holidays/insights').then((r) => r.data)
}

// ─── Offline-First Sync ──────────────────────────────────────────────────────

export interface SyncStatus {
  online: boolean
  pending_changes: number
  pending_events: number
  outbox_queued: number
  outbox_dead: number
  open_conflicts: number
  last_sync_at: string | null
  last_handshake_at: string | null
  server_time: string
}

export interface SyncConflict {
  id: string
  entity: string
  entity_id: string
  local_version: number | null
  cloud_version: number | null
  local_payload: Record<string, unknown>
  cloud_payload: Record<string, unknown>
  resolution: 'lww' | 'merged' | 'needs_review' | 'resolved'
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}

export function getSyncStatus() {
  return api.get<SyncStatus>('/sync/status').then((r) => r.data)
}
export function getSyncConflicts() {
  return api.get<SyncConflict[]>('/sync/conflicts').then((r) => r.data)
}
export function resolveSyncConflict(id: string, choice: 'local' | 'cloud') {
  return api.patch(`/sync/conflicts/${id}`, { choice }).then((r) => r.data)
}

// ─── Customer Rewards & Loyalty ──────────────────────────────────────────────

export type RewardType = 'fuel_discount' | 'store_discount' | 'free_product' | 'car_wash' | 'membership'
export type DiscountType = 'fixed_amount' | 'percentage' | 'free_fuel' | 'free_item'

export interface LoyaltyTier {
  id: string
  business_id: string
  name: string
  min_points: number
  multiplier: number
  benefits: string | null
  sort_order: number
  created_at: string
}

export interface LoyaltyConfig {
  business_id: string
  fuel_points_per_100: number
  store_points_per_100: number
  auto_approve_max: number
  supervisor_approve_max: number
  daily_redeem_limit: number
  monthly_redeem_limit: number
  points_expiry_days: number
  updated_at?: string
}

export interface LoyaltyReward {
  id: string
  business_id: string
  name: string
  description: string
  reward_type: RewardType
  points_required: number
  discount_type: DiscountType | null
  discount_value: number | null
  is_active: boolean
  visible: boolean
  start_date: string | null
  end_date: string | null
  max_redemptions: number | null
  per_customer_limit: number | null
  applicable_fuel_grades: string[]
  applicable_products: string[]
  cost_estimate: number
  redemption_count: number
  scope: 'organization' | 'station'
  branch_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface LoyaltyRedemption {
  id: string
  business_id: string
  branch_id: string | null
  customer_id: string
  customer_name?: string
  reward_id: string | null
  reward_name: string
  points_spent: number
  status: 'pending' | 'approved' | 'rejected' | 'applied' | 'cancelled'
  approval_level: 'auto' | 'supervisor' | 'manager'
  requested_by: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export interface LoyaltyTransaction {
  id: string
  tx_type: 'earn' | 'redeem' | 'adjust' | 'bonus' | 'expire'
  points_delta: number
  balance_after: number
  source: string | null
  reason: string | null
  created_at: string
}

export interface LoyaltyCampaign {
  id: string
  business_id: string
  name: string
  description: string
  campaign_type: 'multiplier' | 'bonus_threshold' | 'double_points'
  multiplier: number
  bonus_points: number
  threshold_amount: number
  applies_to: 'all' | 'fuel' | 'store' | 'premium_fuel'
  start_date: string
  end_date: string
  is_active: boolean
  participation: number
  points_issued: number
  created_at: string
}

export interface LoyaltyWallet {
  customer_id: string
  customer_name: string
  current_points: number
  lifetime_points_earned: number
  lifetime_points_redeemed: number
  tier: string
  tier_multiplier: number
  next_tier: string | null
  points_to_next_tier: number
  available_rewards: LoyaltyReward[]
  recent_redemptions: LoyaltyRedemption[]
  points_history: LoyaltyTransaction[]
}

export interface LoyaltyAnalytics {
  total_members: number
  total_points_issued: number
  total_points_redeemed: number
  outstanding_points: number
  tier_distribution: Record<string, number>
  top_customers: { customer_id: string; name: string; current_points: number; lifetime_earned: number; tier: string }[]
  reward_performance: { reward_id: string; name: string; redemption_count: number; points_spent: number; estimated_cost: number }[]
}

// ── Config & tiers ──
export function getLoyaltyConfig() {
  return api.get<LoyaltyConfig>('/loyalty/config').then((r) => r.data)
}
export function upsertLoyaltyConfig(data: Partial<LoyaltyConfig>) {
  return api.put<LoyaltyConfig>('/loyalty/config', data).then((r) => r.data)
}
export function getLoyaltyTiers() {
  return api.get<LoyaltyTier[]>('/loyalty/tiers').then((r) => r.data)
}
export function upsertLoyaltyTier(data: { id?: string; name: string; min_points: number; multiplier: number; benefits?: string; sort_order?: number }) {
  return api.put<LoyaltyTier>('/loyalty/tiers', data).then((r) => r.data)
}
export function deleteLoyaltyTier(id: string) {
  return api.delete(`/loyalty/tiers/${id}`).then((r) => r.data)
}

// ── Rewards ──
export function getLoyaltyRewards() {
  return api.get<LoyaltyReward[]>('/loyalty/rewards').then((r) => r.data)
}
export type RewardInput = {
  name: string; description?: string; reward_type: RewardType; points_required: number
  discount_type?: DiscountType | null; discount_value?: number | null
  is_active?: boolean; visible?: boolean; start_date?: string | null; end_date?: string | null
  max_redemptions?: number | null; per_customer_limit?: number | null
  applicable_fuel_grades?: string[]; applicable_products?: string[]
  cost_estimate?: number; scope?: 'organization' | 'station'; branch_id?: string | null
}
export function createLoyaltyReward(data: RewardInput) {
  return api.post<LoyaltyReward>('/loyalty/rewards', data).then((r) => r.data)
}
export function updateLoyaltyReward(id: string, data: RewardInput) {
  return api.patch<LoyaltyReward>(`/loyalty/rewards/${id}`, data).then((r) => r.data)
}
export function deleteLoyaltyReward(id: string) {
  return api.delete(`/loyalty/rewards/${id}`).then((r) => r.data)
}

// ── Points & wallet ──
export function getLoyaltyWallet(customerId: string) {
  return api.get<LoyaltyWallet>(`/loyalty/customers/${customerId}/wallet`).then((r) => r.data)
}
export function earnPoints(customerId: string, data: { source: 'fuel' | 'store'; amount: number; premium_fuel?: boolean; idempotency_key?: string }) {
  return api.post<{ points_earned: number; balance: number }>(`/loyalty/customers/${customerId}/earn`, data).then((r) => r.data)
}
export function adjustPoints(customerId: string, delta: number, reason: string) {
  return api.post<{ balance: number }>(`/loyalty/customers/${customerId}/adjust`, { delta, reason }).then((r) => r.data)
}
export function redeemReward(customerId: string, rewardId: string, idempotencyKey?: string) {
  return api.post<LoyaltyRedemption>(`/loyalty/customers/${customerId}/redeem`, { reward_id: rewardId, idempotency_key: idempotencyKey }).then((r) => r.data)
}

// ── Redemptions / approvals ──
export function getLoyaltyRedemptions(status?: string) {
  const q = status ? `?status=${status}` : ''
  return api.get<LoyaltyRedemption[]>(`/loyalty/redemptions${q}`).then((r) => r.data)
}
export function reviewRedemption(id: string, decision: 'approve' | 'reject') {
  return api.patch(`/loyalty/redemptions/${id}`, { decision }).then((r) => r.data)
}

// ── Campaigns ──
export function getLoyaltyCampaigns() {
  return api.get<LoyaltyCampaign[]>('/loyalty/campaigns').then((r) => r.data)
}
export function createLoyaltyCampaign(data: {
  name: string; description?: string; campaign_type?: string; multiplier?: number
  bonus_points?: number; threshold_amount?: number; applies_to?: string; start_date: string; end_date: string
}) {
  return api.post<LoyaltyCampaign>('/loyalty/campaigns', data).then((r) => r.data)
}
export function toggleLoyaltyCampaign(id: string, isActive: boolean) {
  return api.patch(`/loyalty/campaigns/${id}`, { is_active: isActive }).then((r) => r.data)
}

// ── Analytics ──
export function getLoyaltyAnalytics() {
  return api.get<LoyaltyAnalytics>('/loyalty/analytics').then((r) => r.data)
}
