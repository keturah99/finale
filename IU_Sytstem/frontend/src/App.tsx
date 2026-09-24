import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { Toaster } from 'sonner'

import { useAuthStore } from '@/stores/authStore'
import { muiTheme } from '@/lib/theme'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { RequireAuth } from '@/components/guards/RequireAuth'
import { RequireGuest } from '@/components/guards/RequireGuest'
import { AppShell } from '@/components/layout/AppShell'

// ---------- Auth & core ----------
import { Login } from '@/pages/auth/Login'
import { Dashboard } from '@/pages/dashboard/Dashboard'
import { Playground } from '@/pages/Playground'
import { NotFound } from '@/pages/NotFound'

// ---------- Public portal ----------
import { PublicBookingPage } from '@/pages/portal/PublicBookingPage'

// ---------- Wholesale ----------
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

// ---------- Transport ----------
import { TransportLayout } from '@/pages/transport/TransportLayout'
import { BookingsPage } from '@/pages/transport/BookingsPage'
import { BookingDetailPage } from '@/pages/transport/BookingDetailPage'
import { VehiclesPage } from '@/pages/transport/VehiclesPage'
import { DriversPage } from '@/pages/transport/DriversPage'
import { TrailersPage } from '@/pages/transport/TrailersPage'

// ---------------------------------------------------------------------------
// React Query client
// ---------------------------------------------------------------------------

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  return (
    <ErrorBoundary>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <Routes>
              {/* ---------- Public routes ---------- */}
              <Route
                path="/login"
                element={
                  <RequireGuest>
                    <Login />
                  </RequireGuest>
                }
              />

              {/* Customer-facing transport booking portal — no auth, no shell */}
              <Route path="/book" element={<PublicBookingPage />} />

              {/* ---------- Protected app shell ---------- */}
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

                {/* ---------- Wholesale ---------- */}
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
                  <Route
                    path="weekly-sales/:id"
                    element={<WeeklySalesDetailPage />}
                  />
                </Route>

                {/* ---------- Transport ---------- */}
                <Route path="transport" element={<TransportLayout />}>
                  <Route index element={<Navigate to="bookings" replace />} />
                  <Route path="bookings" element={<BookingsPage />} />
                  <Route path="bookings/:id" element={<BookingDetailPage />} />
                  <Route path="vehicles" element={<VehiclesPage />} />
                  <Route path="drivers" element={<DriversPage />} />
                  <Route path="trailers" element={<TrailersPage />} />
                </Route>

                {/* ---------- Other modules (to be added) ---------- */}
                {/* Inventory, Supply Chain, Payroll, Reporting, Admin */}

                {/* ---------- Fallback inside the shell ---------- */}
                <Route path="*" element={<NotFound />} />
              </Route>

              {/* ---------- Catch-all outside the shell ---------- */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>

          <Toaster position="top-right" richColors />
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}