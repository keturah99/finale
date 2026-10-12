import { X } from 'lucide-react'

export function FilterBar({
  children,
  active,
  onClear,
}: {
  children: React.ReactNode
  active?: boolean
  onClear?: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
      {children}
      {active && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <X className="h-3 w-3" />
          Clear filters
        </button>
      )}
    </div>
  )
}