import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router'
import { RootLayout } from './layouts/RootLayout'
import { NotFoundPage, AppNotFound } from './pages/NotFoundPage'
import { LoginPage } from './pages/LoginPage'
import { SignUpPage } from './pages/SignUpPage'
import { DashboardPage } from './pages/DashboardPage'
import { SalesPage } from './pages/SalesPage'
import { CustomersPage } from './pages/AccountsPage'
import { ReportsPage } from './pages/ReportsPage'
import { StaffPage } from './pages/StaffPage'
import { SchedulePage } from './pages/SchedulePage'
import { ChargesPage } from './pages/ChargesPage'
import { AccountSettingsPage } from './pages/AccountSettingsPage'
import { ExpensesPage } from './pages/ExpensesPage'
import { TanksPage } from './pages/TanksPage'
import { ConvenienceStaffPage } from './pages/ConvenienceStaffPage'
import { ConvenienceSchedulePage } from './pages/ConvenienceSchedulePage'
import { ProductsPage } from './pages/ProductsPage'
import { ConvenienceSalesPage } from './pages/ConvenienceSalesPage'

// Root: just renders <Outlet /> — no layout, no auth logic
const rootRoute = createRootRoute({ component: Outlet, notFoundComponent: NotFoundPage })

// Public routes (no sidebar, no auth required)
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signup',
  component: SignUpPage,
})

// Protected layout route (sidebar, topbar, auth-guarded)
// notFoundComponent renders inside the sidebar for unmatched app paths
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_app',
  component: RootLayout,
  notFoundComponent: AppNotFound,
})

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  component: DashboardPage,
})

const salesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/sales',
  component: SalesPage,
})

const accountsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/accounts',
  component: CustomersPage,
})

const reportsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/reports',
  component: ReportsPage,
})

const staffRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/staff',
  component: StaffPage,
})

const scheduleRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/schedule',
  component: SchedulePage,
})

const chargesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/charges',
  component: ChargesPage,
})

const convSalesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/convenience/sales',
  component: ConvenienceSalesPage,
})

const convAccountsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/convenience/accounts',
  component: CustomersPage,
})

const convReportsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/convenience/reports',
  component: ReportsPage,
})

const convStaffRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/convenience/staff',
  component: ConvenienceStaffPage,
})

const convScheduleRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/convenience/schedule',
  component: ConvenienceSchedulePage,
})

const convProductsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/convenience/products',
  component: ProductsPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/settings',
  component: AccountSettingsPage,
})

const expensesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/expenses',
  component: ExpensesPage,
})

const tanksRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/tanks',
  component: TanksPage,
})

export const routeTree = rootRoute.addChildren([
  loginRoute,
  signupRoute,
  appRoute.addChildren([
    dashboardRoute,
    salesRoute,
    accountsRoute,
    reportsRoute,
    staffRoute,
    scheduleRoute,
    chargesRoute,
    convSalesRoute,
    convAccountsRoute,
    convReportsRoute,
    convStaffRoute,
    convScheduleRoute,
    convProductsRoute,
    expensesRoute,
    tanksRoute,
    settingsRoute,
  ]),
])

export type Router = ReturnType<typeof createRouter<typeof routeTree>>
