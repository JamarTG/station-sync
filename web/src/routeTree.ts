import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { RootLayout } from './layouts/RootLayout'
import { DashboardPage } from './pages/DashboardPage'
import { SalesPage } from './pages/SalesPage'
import { AccountsPage } from './pages/AccountsPage'
import { ReportsPage } from './pages/ReportsPage'
import { StaffPage } from './pages/StaffPage'
import { SchedulePage } from './pages/SchedulePage'
import { AccountSettingsPage } from './pages/AccountSettingsPage'

const rootRoute = createRootRoute({ component: RootLayout })

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
})

const convSalesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/convenience/sales',
  component: SalesPage,
})

const convAccountsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/convenience/accounts',
  component: AccountsPage,
})

const convReportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/convenience/reports',
  component: ReportsPage,
})

const ssAccountsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/station/accounts',
  component: AccountsPage,
})

const ssReportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/station/reports',
  component: ReportsPage,
})

const staffRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/station/staff',
  component: StaffPage,
})

const scheduleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/station/schedule',
  component: SchedulePage,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: AccountSettingsPage,
})

export const routeTree = rootRoute.addChildren([
  dashboardRoute,
  convSalesRoute,
  convAccountsRoute,
  convReportsRoute,
  ssAccountsRoute,
  ssReportsRoute,
  staffRoute,
  scheduleRoute,
  settingsRoute,
])

export type Router = ReturnType<typeof createRouter<typeof routeTree>>
