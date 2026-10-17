import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { Toaster } from 'sonner'

import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { useTheme } from '@/hooks/useTheme'
import { lightTheme, darkTheme } from '@/lib/theme'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { RequireAuth } from '@/components/guards/RequireAuth'
import { RequireGuest } from '@/components/guards/RequireGuest'
import { AppShell } from '@/components/layout/AppShell'

import { Login } from '@/pages/auth/Login'
import { Dashboard } from '@/pages/dashboard/Dashboard'
import { Playground } from '@/pages/Playground'
import { NotFound } from '@/pages/NotFound'

import { PublicBookingPage } from '@/pages/portal/PublicBookingPage'

import { InventoryLayout } from '@/pages/inventory/InventoryLayout'
import { ProductsPage } from '@/pages/inventory/ProductsPage'
import { MovementsPage } from '@/pages/inventory/MovementsPage'
import { AlertsPage } from '@/pages/inventory/AlertsPage'

import { SupplyChainLayout } from '@/pages/supplychain/SupplyChainLayout'
import { FarmersPage } from '@/pages/supplychain/FarmersPage'
import { CropsPage } from '@/pages/supplychain/CropsPage'
import { PurchasesPage } from '@/pages/supplychain/PurchasesPage'
import { ProductionPage } from '@/pages/supplychain/ProductionPage'

import { TransportLayout } from '@/pages/transport/TransportLayout'
import { BookingsPage } from '@/pages/transport/BookingsPage'
import { BookingDetailPage } from '@/pages/transport/BookingDetailPage'
import { VehiclesPage } from '@/pages/transport/VehiclesPage'
import { DriversPage } from '@/pages/transport/DriversPage'
import { TrailersPage } from '@/pages/transport/TrailersPage'

import { WholesaleLayout } from '@/pages/wholesale/WholesaleLayout'
import { OutletsPage } from '@/pages/wholesale/OutletsPage'
import { StockLevelsPage } from '@/pages/wholesale/StockLevelsPage'
import { StockInPage } from '@/pages/wholesale/StockInPage'
import { StockOutPage } from '@/pages/wholesale/StockOutPage'
import { DamagesPage } from '@/pages/wholesale/DamagesPage'
import { TransfersPage } from '@/pages/wholesale/TransfersPage'
import { TransferDetailPage } from '@/pages/wholesale/TransferDetailPage'
import { WeeklySalesPage } from '@/pages/wholesale/WeeklySalesPage'
import { WeeklySalesDetailPage } from '@/pages/wholesale/WeeklySalesDetailPage'
import { LaybysPage } from '@/pages/wholesale/LaybysPage'

import { PayrollLayout } from '@/pages/payroll/PayrollLayout'
import { SalariesPage } from '@/pages/payroll/SalariesPage'
import { PayrollRunsPage } from '@/pages/payroll/PayrollRunsPage'
import { PayrollRunDetailPage } from '@/pages/payroll/PayrollRunDetailPage'
import { MyPayslipsPage } from '@/pages/payroll/MyPayslipsPage'
import { BankExportsPage } from '@/pages/payroll/BankExportsPage'

import { ReportingLayout } from '@/pages/reporting/ReportingLayout'
import { ReportCataloguePage } from '@/pages/reporting/ReportCataloguePage'
import { ReportLogsPage } from '@/pages/reporting/ReportLogsPage'

import {
  FinanceLayout,
  FinanceDashboardPage,
  FinanceQueuePage,
  FinanceAuditLogPage,
} from '@/pages/finance'
import {
  CashierLayout,
  CashierDashboardPage,
  MySubmissionsPage,
} from '@/pages/cashier'

import { AdminLayout } from '@/pages/admin/AdminLayout'
import { UsersPage } from '@/pages/admin/UsersPage'
import { DepartmentsPage } from '@/pages/admin/DepartmentsPage'
import { RolesPage } from '@/pages/admin/RolesPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate)
  const resolved = useThemeStore((s) => s.resolved)

  useTheme() // applies the `dark` class and initialises the store

  useEffect(() => {
    hydrate()
  }, [hydrate])

  const theme = resolved === 'dark' ? darkTheme : lightTheme

  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <Routes>
              <Route
                path="/login"
                element={
                  <RequireGuest>
                    <Login />
                  </RequireGuest>
                }
              />
              <Route path="/book" element={<PublicBookingPage />} />

              <Route
                path="/"
                element={
                  <RequireAuth>
                    <AppShell />
                  </RequireAuth>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="playground" element={<Playground />} />

                <Route path="inventory" element={<InventoryLayout />}>
                  <Route index element={<Navigate to="products" replace />} />
                  <Route path="products" element={<ProductsPage />} />
                  <Route path="movements" element={<MovementsPage />} />
                  <Route path="alerts" element={<AlertsPage />} />
                </Route>

                <Route path="supply-chain" element={<SupplyChainLayout />}>
                  <Route index element={<Navigate to="farmers" replace />} />
                  <Route path="farmers" element={<FarmersPage />} />
                  <Route path="crops" element={<CropsPage />} />
                  <Route path="purchases" element={<PurchasesPage />} />
                  <Route path="production" element={<ProductionPage />} />
                </Route>

                <Route path="transport" element={<TransportLayout />}>
                  <Route index element={<Navigate to="bookings" replace />} />
                  <Route path="bookings" element={<BookingsPage />} />
                  <Route path="bookings/:id" element={<BookingDetailPage />} />
                  <Route path="vehicles" element={<VehiclesPage />} />
                  <Route path="drivers" element={<DriversPage />} />
                  <Route path="trailers" element={<TrailersPage />} />
                </Route>

                <Route path="wholesale" element={<WholesaleLayout />}>
                  <Route index element={<Navigate to="outlets" replace />} />
                  <Route path="outlets" element={<OutletsPage />} />
                  <Route path="stock" element={<StockLevelsPage />} />
                  <Route path="stock-in" element={<StockInPage />} />
                  <Route path="stock-out" element={<StockOutPage />} />
                  <Route path="damages" element={<DamagesPage />} />
                  <Route path="transfers" element={<TransfersPage />} />
                  <Route path="transfers/:id" element={<TransferDetailPage />} />
                  <Route path="weekly-sales" element={<WeeklySalesPage />} />
                  <Route path="weekly-sales/:id" element={<WeeklySalesDetailPage />} />
                  <Route path="laybys" element={<LaybysPage />} />
                </Route>

                {/* ---------- Cashier ---------- */}
                <Route path="cashier" element={<CashierLayout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<CashierDashboardPage />} />
                  <Route path="my-submissions" element={<MySubmissionsPage />} />
                </Route>
                              
                {/* ---------- Finance ---------- */}
                <Route path="finance" element={<FinanceLayout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<FinanceDashboardPage />} />
                  <Route path="queue" element={<FinanceQueuePage />} />
                  <Route path="audit-log" element={<FinanceAuditLogPage />} />
                </Route>

                <Route path="payroll" element={<PayrollLayout />}>
                  <Route index element={<Navigate to="salaries" replace />} />
                  <Route path="salaries" element={<SalariesPage />} />
                  <Route path="runs" element={<PayrollRunsPage />} />
                  <Route path="runs/:id" element={<PayrollRunDetailPage />} />
                  <Route path="payslips" element={<MyPayslipsPage />} />
                  <Route path="bank-exports" element={<BankExportsPage />} />
                </Route>

                <Route path="reporting" element={<ReportingLayout />}>
                  <Route index element={<Navigate to="catalogue" replace />} />
                  <Route path="catalogue" element={<ReportCataloguePage />} />
                  <Route path="logs" element={<ReportLogsPage />} />
                </Route>

                <Route path="admin" element={<AdminLayout />}>
                  <Route index element={<Navigate to="users" replace />} />
                  <Route path="users" element={<UsersPage />} />
                  <Route path="departments" element={<DepartmentsPage />} />
                  <Route path="roles" element={<RolesPage />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Route>

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>

          <Toaster
            position="top-right"
            richColors
            theme={resolved === 'dark' ? 'dark' : 'light'}
          />
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}