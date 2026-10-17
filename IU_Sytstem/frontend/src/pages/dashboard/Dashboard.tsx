import { useNavigate } from 'react-router-dom'
import {
  Package,
  Truck,
  Store,
  Wallet,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Boxes,
  Users,
  ClipboardList,
  Activity,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { useTheme } from '@mui/material/styles'

import { PageHeader } from '@/components/shared/PageHeader'
import { CardSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { userFullName, formatK, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import {
  useDashboard,
  useRecentBookings,
  useRecentTransfers,
  useWeeklySalesTrend,
} from '@/hooks/queries/useDashboard'

export function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const muiTheme = useTheme()
  const isDark = muiTheme.palette.mode === 'dark'

  const { data: summary, isLoading: loadingSummary } = useDashboard()
  const { data: recentBookings = [], isLoading: loadingBookings } = useRecentBookings()
  const { data: recentTransfers = [], isLoading: loadingTransfers } = useRecentTransfers()
  const { data: trend = [], isLoading: loadingTrend } = useWeeklySalesTrend()

  const chartColor = isDark ? '#4a7fc1' : '#1a3a6c'
  const gridColor = isDark ? '#1e293b' : '#f1f5f9'
  const axisColor = isDark ? '#94a3b8' : '#64748b'

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${userFullName(user)}`}
        description="Operational snapshot across inventory, transport, wholesale, and payroll."
      />

      {loadingSummary ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={Boxes}
            label="Stock Value"
            value={formatK(summary.inventory.stock_value)}
            sub={`${summary.inventory.products} products`}
            onClick={() => navigate('/wholesale/stock')}
          />
          <KpiCard
            icon={ClipboardList}
            label="Pending Bookings"
            value={String(summary.transport.bookings_pending)}
            sub={`${summary.transport.bookings_in_transit} in transit`}
            tone={summary.transport.bookings_pending > 0 ? 'warning' : 'default'}
            onClick={() => navigate('/transport/bookings')}
          />
          <KpiCard
            icon={AlertTriangle}
            label="Low Stock Alerts"
            value={String(summary.inventory.unresolved_alerts)}
            sub={
              summary.inventory.unresolved_alerts === 0
                ? 'All good'
                : 'Needs attention'
            }
            tone={summary.inventory.unresolved_alerts > 0 ? 'warning' : 'positive'}
            onClick={() => navigate('/wholesale/stock')}
          />
          <KpiCard
            icon={Users}
            label="Fleet Ready"
            value={`${summary.transport.available_vehicles}/${summary.transport.vehicles}`}
            sub={`${summary.transport.drivers} drivers`}
            onClick={() => navigate('/transport/vehicles')}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Weekly Sales Trend
              </h2>
            </div>
            <button
              onClick={() => navigate('/wholesale/weekly-sales')}
              className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              View all →
            </button>
          </div>

          {loadingTrend ? (
            <div className="h-56 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          ) : trend.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
              No weekly sales data yet
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend.map(toChartPoint)}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: axisColor }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: axisColor }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `K${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 6,
                      border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                      backgroundColor: isDark ? '#1e293b' : '#ffffff',
                      color: isDark ? '#f1f5f9' : '#0f172a',
                      fontSize: 12,
                    }}
                    formatter={(value) => [formatK(Number(value)), 'Cashed']}
                  />
                  <Line
                    type="monotone"
                    dataKey="cashed"
                    stroke={chartColor}
                    strokeWidth={2}
                    dot={{ r: 3, fill: chartColor }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {summary && (
            <>
              <MiniStat
                icon={Store}
                label="Farmers"
                value={String(summary.supply_chain.farmers)}
              />
              <MiniStat
                icon={Package}
                label="Produce Purchased"
                value={formatK(summary.supply_chain.purchases_value)}
                sub={`${summary.supply_chain.purchases_count} purchases`}
              />
              <MiniStat
                icon={Wallet}
                label="Outstanding Laybys"
                value={formatK(summary.supply_chain.outstanding_balance)}
                sub={`${summary.supply_chain.pending_collections} pending`}
              />
              <MiniStat
                icon={Activity}
                label="Last Payroll Run"
                value={summary.payroll.last_run?.period_label ?? 'None yet'}
                sub={
                  summary.payroll.last_run
                    ? formatDate(summary.payroll.last_run.processed_at)
                    : `${summary.payroll.runs_completed} runs completed`
                }
              />
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ActivityPanel
          title="Recent Bookings"
          icon={Truck}
          viewAllHref="/transport/bookings"
          isLoading={loadingBookings}
          isEmpty={recentBookings.length === 0}
          emptyTitle="No bookings yet"
          emptyDescription="New customer bookings will appear here."
        >
          {recentBookings.map((b) => (
            <li
              key={b.id}
              onClick={() => navigate(`/transport/bookings/${b.id}`)}
              className="flex cursor-pointer items-center justify-between px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100 dark:text-slate-200">
                  #{b.id} — {b.customer_name}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {b.pickup_location} → {b.delivery_location}
                </p>
              </div>
              <StatusBadge status={b.status} />
            </li>
          ))}
        </ActivityPanel>

        <ActivityPanel
          title="Recent Transfers"
          icon={ArrowRight}
          viewAllHref="/wholesale/transfers"
          isLoading={loadingTransfers}
          isEmpty={recentTransfers.length === 0}
          emptyTitle="No transfers yet"
          emptyDescription="Inter-outlet stock movements will appear here."
        >
          {recentTransfers.map((t) => (
            <li
              key={t.id}
              onClick={() => navigate(`/wholesale/transfers/${t.id}`)}
              className="flex cursor-pointer items-center justify-between px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100 dark:text-slate-200">
                  {t.from_name} → {t.to_name}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {t.product_name} · {t.quantity} units
                </p>
              </div>
              <StatusBadge status={t.status} />
            </li>
          ))}
        </ActivityPanel>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate('/transport/bookings')}>
            <Truck className="h-4 w-4" /> New Booking
          </Button>
          <Button variant="outline" onClick={() => navigate('/wholesale/stock-in')}>
            <Package className="h-4 w-4" /> Record Stock In
          </Button>
          <Button variant="outline" onClick={() => navigate('/wholesale/transfers')}>
            <ArrowRight className="h-4 w-4" /> Create Transfer
          </Button>
          <Button variant="outline" onClick={() => navigate('/wholesale/weekly-sales')}>
            <Store className="h-4 w-4" /> Weekly Sales
          </Button>
          <Button variant="ghost" onClick={() => window.open('/book', '_blank')}>
            Open Public Portal ↗
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'default',
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'positive' | 'warning' | 'negative'
  onClick?: () => void
}) {
  const toneClass = {
    default: 'text-slate-800 dark:text-slate-100',
    positive: 'text-emerald-700 dark:text-emerald-400',
    warning: 'text-amber-700 dark:text-amber-400',
    negative: 'text-red-700 dark:text-red-400',
  }[tone]

  const iconClass = {
    default: 'text-slate-400 dark:text-slate-500',
    positive: 'text-emerald-500 dark:text-emerald-400',
    warning: 'text-amber-500 dark:text-amber-400',
    negative: 'text-red-500 dark:text-red-400',
  }[tone]

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900',
        onClick &&
          'cursor-pointer transition hover:border-slate-300 hover:shadow-sm dark:hover:border-slate-600',
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', iconClass)} />
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </p>
      </div>
      <p className={cn('mt-2 text-2xl font-semibold', toneClass)}>{value}</p>
      {sub && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</p>
      )}
    </div>
  )
}

function MiniStat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </p>
      </div>
      <p className="mt-1.5 text-lg font-semibold text-slate-800 dark:text-slate-100">
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>
      )}
    </div>
  )
}

function ActivityPanel({
  title,
  icon: Icon,
  viewAllHref,
  isLoading,
  isEmpty,
  emptyTitle,
  emptyDescription,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  viewAllHref: string
  isLoading: boolean
  isEmpty: boolean
  emptyTitle: string
  emptyDescription: string
  children: React.ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-4 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {title}
          </h2>
        </div>
        <button
          onClick={() => navigate(viewAllHref)}
          className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
        >
          View all →
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">
          <div className="h-8 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          <div className="h-8 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          <div className="h-8 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        </div>
      ) : isEmpty ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {children}
        </ul>
      )}
    </div>
  )
}

function toChartPoint(cycle: import('@/types/wholesale').WeeklySales) {
  return {
    label: cycle.label.replace('Wk ', 'W').replace(' — ', '/'),
    cashed: Number(cycle.total_cashed || 0),
    expenses: Number(cycle.total_expenses || 0),
    damages: Number(cycle.total_damages_value || 0),
    net: Number(cycle.net_position || 0),
  }
}