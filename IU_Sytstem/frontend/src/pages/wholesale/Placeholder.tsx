import { EmptyState } from '@/components/shared/EmptyState'
import { Construction } from 'lucide-react'

export function WholesalePlaceholder({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <EmptyState
        icon={Construction}
        title={`${title} coming soon`}
        description="This section will be built in a follow-up step."
      />
    </div>
  )
}