import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { DashboardData } from '@/types/reporting'
import type { TransportBooking } from '@/types/transport'
import type { Transfer, WeeklySales } from '@/types/wholesale'

// ---------------------------------------------------------------------------
// Pagination helper
// ---------------------------------------------------------------------------

interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

async function fetchList<T>(
  url: string,
  params?: Record<string, unknown>,
): Promise<T[]> {
  const { data } = await api.get<Paginated<T> | T[]>(url, { params })
  return Array.isArray(data) ? data : data.results
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: () => [...dashboardKeys.all, 'summary'] as const,
  recentBookings: () => [...dashboardKeys.all, 'recent-bookings'] as const,
  recentTransfers: () => [...dashboardKeys.all, 'recent-transfers'] as const,
  weeklySalesTrend: () => [...dashboardKeys.all, 'weekly-sales-trend'] as const,
}

// ---------------------------------------------------------------------------
// Main KPI summary
// ---------------------------------------------------------------------------

export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: async () => {
      const { data } = await api.get<DashboardData>('/api/reporting/dashboard/')
      return data
    },
  })
}

// ---------------------------------------------------------------------------
// Recent activity
// ---------------------------------------------------------------------------

export function useRecentBookings() {
  return useQuery({
    queryKey: dashboardKeys.recentBookings(),
    queryFn: () =>
      fetchList<TransportBooking>('/api/transport/bookings/', {
        ordering: '-created_at',
        page_size: 5,
      }),
  })
}

export function useRecentTransfers() {
  return useQuery({
    queryKey: dashboardKeys.recentTransfers(),
    queryFn: () =>
      fetchList<Transfer>('/api/wholesale/transfers/', {
        ordering: '-initiated_at',
        page_size: 5,
      }),
  })
}

// ---------------------------------------------------------------------------
// Weekly sales trend (last 8 cycles)
// ---------------------------------------------------------------------------

export function useWeeklySalesTrend() {
  return useQuery({
    queryKey: dashboardKeys.weeklySalesTrend(),
    queryFn: async () => {
      const cycles = await fetchList<WeeklySales>(
        '/api/wholesale/weekly-sales/',
        {
          ordering: '-year,-week_number',
          page_size: 8,
        },
      )
      // Reverse so charts plot oldest → newest
      return [...cycles].reverse()
    },
  })
}