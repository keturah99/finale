import { cn } from '@/lib/utils'

const STATUS_MAP: Record<string, string> = {
  active:
    'bg-emerald-50 text-emerald-700 border-emerald-200 ' +
    'dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
  inactive:
    'bg-slate-100 text-slate-600 border-slate-200 ' +
    'dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',

  pending:
    'bg-slate-100 text-slate-700 border-slate-200 ' +
    'dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  assigned:
    'bg-blue-50 text-blue-700 border-blue-200 ' +
    'dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900',
  in_transit:
    'bg-amber-50 text-amber-700 border-amber-200 ' +
    'dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
  delivered:
    'bg-emerald-50 text-emerald-700 border-emerald-200 ' +
    'dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
  cancelled:
    'bg-red-50 text-red-700 border-red-200 ' +
    'dark:bg-red-950/40 dark:text-red-400 dark:border-red-900',

  received:
    'bg-emerald-50 text-emerald-700 border-emerald-200 ' +
    'dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',

  low:
    'bg-amber-50 text-amber-700 border-amber-200 ' +
    'dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
  out:
    'bg-red-50 text-red-700 border-red-200 ' +
    'dark:bg-red-950/40 dark:text-red-400 dark:border-red-900',
  available:
    'bg-emerald-50 text-emerald-700 border-emerald-200 ' +
    'dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
  on_trip:
    'bg-amber-50 text-amber-700 border-amber-200 ' +
    'dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
  maintenance:
    'bg-orange-50 text-orange-700 border-orange-200 ' +
    'dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900',
  retired:
    'bg-slate-100 text-slate-600 border-slate-200 ' +
    'dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',

  public:
    'bg-indigo-50 text-indigo-700 border-indigo-200 ' +
    'dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900',
  private:
    'bg-slate-100 text-slate-700 border-slate-200 ' +
    'dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',

  open:
    'bg-blue-50 text-blue-700 border-blue-200 ' +
    'dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900',
  closed:
    'bg-slate-100 text-slate-600 border-slate-200 ' +
    'dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  completed:
    'bg-emerald-50 text-emerald-700 border-emerald-200 ' +
    'dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
  processing:
    'bg-amber-50 text-amber-700 border-amber-200 ' +
    'dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
  draft:
    'bg-slate-100 text-slate-600 border-slate-200 ' +
    'dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',

  paid:
    'bg-emerald-50 text-emerald-700 border-emerald-200 ' +
    'dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
  partial:
    'bg-amber-50 text-amber-700 border-amber-200 ' +
    'dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',

  in:
    'bg-emerald-50 text-emerald-700 border-emerald-200 ' +
    'dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
  adjust:
    'bg-blue-50 text-blue-700 border-blue-200 ' +
    'dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900',

  ready:
    'bg-blue-50 text-blue-700 border-blue-200 ' +
    'dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900',
  collected:
    'bg-emerald-50 text-emerald-700 border-emerald-200 ' +
    'dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',

  planned:
    'bg-slate-100 text-slate-700 border-slate-200 ' +
    'dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  in_progress:
    'bg-amber-50 text-amber-700 border-amber-200 ' +
    'dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
}

const DEFAULT_CLASS =
  'bg-slate-100 text-slate-700 border-slate-200 ' +
  'dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'

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