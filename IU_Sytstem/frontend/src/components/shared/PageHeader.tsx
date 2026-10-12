import { useIsReadOnly } from '@/hooks/useIsReadOnly'

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  const isReadOnly = useIsReadOnly()

  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>
      {actions && !isReadOnly && (
        <div className="flex items-center gap-2">{actions}</div>
      )}
    </div>
  )
}