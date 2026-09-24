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

  const { data: summary, isLoading: loadingSummary } = useDashboard()
  const { data: recentBookings = [], isLoading: loadingBookings } =
    useRecentBookings()
  const { data: recentTransfers = [], isLoading: loadingTransfers } =
    useRecentTransfers()
  const { data: trend = [], isLoading: loadingTrend } = useWeeklySalesTrend()

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${userFullName(user)}`}
        description="Operational snapshot across inventory, transport, wholesale, and payroll."
      />

      {/* ---------- KPI cards ---------- */}
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
            tone="default"
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
            tone="default"
            onClick={() => navigate('/transport/vehicles')}
          />
        </div>
      ) : null}

      {/* ---------- Second row: chart + subsidiary KPIs ---------- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Weekly sales trend */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Weekly Sales Trend
              </h2>
            </div>
            <button
              onClick={() => navigate('/wholesale/weekly-sales')}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              View all →
            </button>
          </div>

          {loadingTrend ? (
            <div className="h-56 animate-pulse rounded bg-slate-100" />
          ) : trend.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-slate-400">
              No weekly sales data yet
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend.map(toChartPoint)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `K${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 6,
                      border: '1px solid #e2e8f0',
                      fontSize: 12,
                    }}
                    formatter={(value) => [formatK(Number(value)), 'Cashed']}
                  />
                  <Line
                    type="monotone"
                    dataKey="cashed"
                    stroke="#1a3a6c"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#1a3a6c' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Supply chain + Payroll summary */}
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

      {/* ---------- Third row: recent activity ---------- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent bookings */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Recent Bookings
              </h2>
            </div>
            <button
              onClick={() => navigate('/transport/bookings')}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              View all →
            </button>
          </div>

          {loadingBookings ? (
            <div className="space-y-2 p-4">
              <div className="h-8 animate-pulse rounded bg-slate-100" />
              <div className="h-8 animate-pulse rounded bg-slate-100" />
              <div className="h-8 animate-pulse rounded bg-slate-100" />
            </div>
          ) : recentBookings.length === 0 ? (
            <EmptyState
              title="No bookings yet"
              description="New customer bookings will appear here."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentBookings.map((b) => (
                <li
                  key={b.id}
                  onClick={() => navigate(`/transport/bookings/${b.id}`)}
                  className="flex cursor-pointer items-center justify-between px-4 py-3 transition hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      #{b.id} — {b.customer_name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {b.pickup_location} → {b.delivery_location}
                    </p>
                  </div>
                  <StatusBadge status={b.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent transfers */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <div className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Recent Transfers
              </h2>
            </div>
            <button
              onClick={() => navigate('/wholesale/transfers')}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              View all →
            </button>
          </div>

          {loadingTransfers ? (
            <div className="space-y-2 p-4">
              <div className="h-8 animate-pulse rounded bg-slate-100" />
              <div className="h-8 animate-pulse rounded bg-slate-100" />
              <div className="h-8 animate-pulse rounded bg-slate-100" />
            </div>
          ) : recentTransfers.length === 0 ? (
            <EmptyState
              title="No transfers yet"
              description="Inter-outlet stock movements will appear here."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentTransfers.map((t) => (
                <li
                  key={t.id}
                  onClick={() => navigate(`/wholesale/transfers/${t.id}`)}
                  className="flex cursor-pointer items-center justify-between px-4 py-3 transition hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {t.from_name} → {t.to_name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {t.product_name} · {t.quantity} units
                    </p>
                  </div>
                  <StatusBadge status={t.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ---------- Quick actions ---------- */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate('/transport/bookings')}>
            <Truck className="h-4 w-4" />
            New Booking
          </Button>
          <Button variant="outline" onClick={() => navigate('/wholesale/stock-in')}>
            <Package className="h-4 w-4" />
            Record Stock In
          </Button>
          <Button variant="outline" onClick={() => navigate('/wholesale/transfers')}>
            <ArrowRight className="h-4 w-4" />
            Create Transfer
          </Button>
          <Button variant="outline" onClick={() => navigate('/wholesale/weekly-sales')}>
            <Store className="h-4 w-4" />
            Weekly Sales
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
    default: 'text-slate-800',
    positive: 'text-emerald-700',
    warning: 'text-amber-700',
    negative: 'text-red-700',
  }[tone]

  const iconClass = {
    default: 'text-slate-400',
    positive: 'text-emerald-500',
    warning: 'text-amber-500',
    negative: 'text-red-500',
  }[tone]

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-lg border border-slate-200 bg-white p-5',
        onClick &&
          'cursor-pointer transition hover:border-slate-300 hover:shadow-sm',
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', iconClass)} />
        <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      </div>
      <p className={cn('mt-2 text-2xl font-semibold', toneClass)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mini stat (right column)
// ---------------------------------------------------------------------------

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
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-slate-400" />
        <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      </div>
      <p className="mt-1.5 text-lg font-semibold text-slate-800">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart helpers
// ---------------------------------------------------------------------------

function toChartPoint(cycle: import('@/types/wholesale').WeeklySales) {
  return {
    label: cycle.label.replace('Wk ', 'W').replace(' — ', '/'),
    cashed: Number(cycle.total_cashed || 0),
    expenses: Number(cycle.total_expenses || 0),
    damages: Number(cycle.total_damages_value || 0),
    net: Number(cycle.net_position || 0),
  }
}