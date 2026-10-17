import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Banknote,
  Receipt,
  ShieldAlert,
  TrendingUp,
  Clock,
} from 'lucide-react'

import { CardSkeleton } from '@/components/shared/LoadingSkeleton'
import { useFinanceDashboard } from '@/hooks/queries/useFinance'
import { formatK } from '@/lib/format'
import { cn } from '@/lib/utils'

export function FinanceDashboardPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useFinanceDashboard()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    )
  }

  if (!data) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Unable to load finance dashboard.
      </p>
    )
  }

  const { pending, flagged_count, aging, approved_today, approved_this_week } = data
  const hasBacklog = aging['8_14'] + aging['15_plus'] > 0

  return (
    <div className="space-y-6">
      {/* Backlog alert */}
      {hasBacklog && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-sm text-amber-800 dark:text-amber-300">
            <p className="font-medium">Finance backlog detected</p>
            <p className="mt-0.5">
              {aging['8_14'] + aging['15_plus']} item(s) have been pending for more than 7 days.
            </p>
          </div>
        </div>
      )}

      {/* Top KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Clock}
          label="Pending Review"
          value={String(pending.total_count)}
          sub={`${flagged_count} flagged`}
          tone={pending.total_count > 0 ? 'warning' : 'positive'}
          onClick={() => navigate('/finance/queue')}
        />
        <KpiCard
          icon={Banknote}
          label="Cash-Ins Pending"
          value={formatK(pending.cash_ins.value)}
          sub={`${pending.cash_ins.count} item(s)`}
          onClick={() => navigate('/finance/queue?type=cash_in')}
        />
        <KpiCard
          icon={Receipt}
          label="Expenses Pending"
          value={formatK(pending.expenses.value)}
          sub={`${pending.expenses.count} item(s)`}
          onClick={() => navigate('/finance/queue?type=expense')}
        />
        <KpiCard
          icon={ShieldAlert}
          label="Damages Pending"
          value={formatK(pending.damages.value)}
          sub={`${pending.damages.count} item(s)`}
          onClick={() => navigate('/finance/queue?type=damage')}
        />
      </div>

      {/* Aging + throughput */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Aging of Pending Items
            </h2>
          </div>

          <div className="space-y-2">
            <AgingRow label="0–3 days" count={aging['0_3']} tone="positive" />
            <AgingRow label="4–7 days" count={aging['4_7']} tone="warning" />
            <AgingRow label="8–14 days" count={aging['8_14']} tone="warning" />
            <AgingRow label="15+ days" count={aging['15_plus']} tone="critical" />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Approval Throughput
            </h2>
          </div>

          <div className="space-y-4">
            <ThroughputRow label="Approved Today" value={approved_today} />
            <ThroughputRow label="Approved This Week" value={approved_this_week} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
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
  tone?: 'default' | 'positive' | 'warning' | 'critical'
  onClick?: () => void
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
    <div
      onClick={onClick}
      className={cn(
        'rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900',
        onClick &&
          'cursor-pointer transition hover:border-slate-300 hover:shadow-sm dark:hover:border-slate-600',
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', iconColor)} />
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </p>
      </div>
      <p className={cn('mt-2 text-2xl font-semibold', valueColor)}>{value}</p>
      {sub && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</p>
      )}
    </div>
  )
}

function AgingRow({
  label,
  count,
  tone,
}: {
  label: string
  count: number
  tone: 'positive' | 'warning' | 'critical'
}) {
  const color = {
    positive: 'bg-emerald-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500',
  }[tone]

  return (
    <div className="flex items-center gap-3">
      <span className={cn('h-2 w-2 shrink-0 rounded-full', color)} />
      <span className="flex-1 text-sm text-slate-600 dark:text-slate-300">
        {label}
      </span>
      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
        {count}
      </span>
    </div>
  )
}

function ThroughputRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
      <span className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">
        {formatK(value)}
      </span>
    </div>
  )
}