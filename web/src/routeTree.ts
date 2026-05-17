import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router'
import { RootLayout } from './layouts/RootLayout'
import { LoginPage } from './pages/LoginPage'
import { SignUpPage } from './pages/SignUpPage'
import { DashboardPage } from './pages/DashboardPage'
import { SalesPage } from './pages/SalesPage'
import { AccountsPage } from './pages/AccountsPage'
import { ReportsPage } from './pages/ReportsPage'
import { StaffPage } from './pages/StaffPage'
import { SchedulePage } from './pages/SchedulePage'
import { AccountSettingsPage } from './pages/AccountSettingsPage'
import { ExpensesPage } from './pages/ExpensesPage'

// Root: just renders <Outlet /> — no layout, no auth logic
const rootRoute = createRootRoute({ component: Outlet })

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
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_app',
  component: RootLayout,
})

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  component: DashboardPage,
})

const convSalesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/convenience/sales',
  component: SalesPage,
})

const convAccountsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/convenience/accounts',
  component: AccountsPage,
})

const convReportsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/convenience/reports',
  component: ReportsPage,
})

const ssAccountsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/station/accounts',
  component: AccountsPage,
})

const ssReportsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/station/reports',
  component: ReportsPage,
})

const staffRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/station/staff',
  component: StaffPage,
})

const scheduleRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/station/schedule',
  component: SchedulePage,
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

export const routeTree = rootRoute.addChildren([
  loginRoute,
  signupRoute,
  appRoute.addChildren([
    dashboardRoute,
    expensesRoute,
    convSalesRoute,
    convAccountsRoute,
    convReportsRoute,
    ssAccountsRoute,
    ssReportsRoute,
    staffRoute,
    scheduleRoute,
    settingsRoute,
  ]),
])

export type Router = ReturnType<typeof createRouter<typeof routeTree>>
