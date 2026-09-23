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

import { Login } from '@/pages/auth/Login'
import { Dashboard } from '@/pages/dashboard/Dashboard'
import { Playground } from '@/pages/Playground'
import { NotFound } from '@/pages/NotFound'

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
              {/* Public auth route */}
              <Route
                path="/login"
                element={
                  <RequireGuest>
                    <Login />
                  </RequireGuest>
                }
              />

              {/* Protected app shell */}
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

                {/* Dev-only playground */}
                <Route path="playground" element={<Playground />} />

                {/* Module routes will be added in later phases:
                    inventory, supply-chain, transport, payroll,
                    wholesale, reporting, admin
                */}

                <Route path="*" element={<NotFound />} />
              </Route>

              {/* Catch-all outside the shell */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="top-right" richColors />
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}