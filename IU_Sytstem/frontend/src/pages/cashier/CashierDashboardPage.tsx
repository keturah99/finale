import { useNavigate } from 'react-router-dom'
import {
  Banknote,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Plus,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CardSkeleton } from '@/components/shared/LoadingSkeleton'
import { useDailySummary, useWeeklySummary } from '@/hooks/queries/useCashier'
import { formatK } from '@/lib/format'

export function CashierDashboardPage() {
  const navigate = useNavigate()
  const { data: daily, isLoading: loadingDaily } = useDailySummary()
  const { data: weekly, isLoading: loadingWeekly } = useWeeklySummary()

  return (
    <div className="space-y-6">
      {/* Quick action */}
      <div className="flex justify-end">
        <Button onClick={() => navigate('/wholesale/weekly-sales')}>
          <Plus className="h-4 w-4" />
          New Cash-In
        </Button>
      </div>

      {/* Alerts */}
      {daily && (daily.queried_count > 0 || daily.rejected_count > 0) && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1 text-sm text-amber-800 dark:text-amber-300">
            <p className="font-medium">Items need your attention</p>
            <p className="mt-0.5">
              {daily.queried_count} queried
              {daily.rejected_count > 0 && ` · ${daily.rejected_count} rejected`}
              {' — '}
              <button
                onClick={() => navigate('/cashier/my-submissions?status=queried')}
                className="underline hover:no-underline"
              >
                review them
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Today's summary */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Today
        </h2>

        {loadingDaily ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : daily ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Banknote}
              label="Total Cash-In"
              value={formatK(daily.total_amount)}
              sub={`${daily.count} submission(s)`}
            />
            <StatCard
              icon={CheckCircle2}
              label="Approved"
              value={formatK(daily.approved_amount)}
              sub={`${daily.approved_count} approved`}
              tone="positive"
            />
            <StatCard
              icon={Clock}
              label="Pending Review"
              value={formatK(daily.pending_amount)}
              sub={`${daily.pending_count} pending`}
              tone={daily.pending_count > 0 ? 'warning' : 'default'}
            />
            <StatCard
              icon={AlertTriangle}
              label="Needs Attention"
              value={String(daily.queried_count + daily.rejected_count)}
              sub={`${daily.queried_count} queried · ${daily.rejected_count} rejected`}
              tone={
                daily.queried_count + daily.rejected_count > 0
                  ? 'critical'
                  : 'default'
              }
            />
          </div>
        ) : null}
      </section>

      {/* Last 7 days */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Last 7 Days
        </h2>

        {loadingWeekly ? (
          <div className="h-40 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        ) : weekly ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="space-y-2">
              {weekly.days.map((day) => (
                <div
                  key={day.date}
                  className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-b-0 dark:border-slate-800"
                >
                  <span className="text-slate-500 dark:text-slate-400">
                    {day.date}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {day.count} entries
                    </span>
                    {day.pending_count > 0 && (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
                        {day.pending_count} pending
                      </span>
                    )}
                    <span className="w-24 text-right font-medium text-slate-800 dark:text-slate-200">
                      {formatK(day.total)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'default',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'positive' | 'warning' | 'critical'
}) {
  const valueColor = {
    default: 'text-slate-800 dark:text-slate-100',
    positive: 'text-emerald-700 dark:text-emerald-400',
    warning: 'text-amber-700 dark:text-amber-400',
    critical: 'text-red-700 dark:text-red-400',
  }[tone]

  const iconColor = {
    default: 'text-slate-400 dark:text-slate-500',
    positive: 'text-emerald-500 dark:text-emerald-400',
    warning: 'text-amber-500 dark:text-amber-400',
    critical: 'text-red-500 dark:text-red-400',
  }[tone]

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </p>
      </div>
      <p className={`mt-2 text-2xl font-semibold ${valueColor}`}>{value}</p>
      {sub && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</p>
      )}
    </div>
  )
}