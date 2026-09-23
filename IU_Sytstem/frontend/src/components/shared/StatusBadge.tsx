import { cn } from '@/lib/utils'

const STATUS_MAP: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  inactive: 'bg-slate-100 text-slate-600 border-slate-200',

  pending: 'bg-slate-100 text-slate-700 border-slate-200',
  assigned: 'bg-blue-50 text-blue-700 border-blue-200',
  in_transit: 'bg-amber-50 text-amber-700 border-amber-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',

  received: 'bg-emerald-50 text-emerald-700 border-emerald-200',

  low: 'bg-amber-50 text-amber-700 border-amber-200',
  out: 'bg-red-50 text-red-700 border-red-200',
  available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  on_trip: 'bg-amber-50 text-amber-700 border-amber-200',
  maintenance: 'bg-orange-50 text-orange-700 border-orange-200',
  retired: 'bg-slate-100 text-slate-600 border-slate-200',

  public: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  private: 'bg-slate-100 text-slate-700 border-slate-200',

  open: 'bg-blue-50 text-blue-700 border-blue-200',
  closed: 'bg-slate-100 text-slate-600 border-slate-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  processing: 'bg-amber-50 text-amber-700 border-amber-200',
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
}

const DEFAULT_CLASS = 'bg-slate-100 text-slate-700 border-slate-200'

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string
  label?: string
  className?: string
}) {
  const style = STATUS_MAP[status] ?? DEFAULT_CLASS
  const text = label ?? status.replace(/_/g, ' ')
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize',
        style,
        className,
      )}
    >
      {text}
    </span>
  )
}