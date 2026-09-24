import { EmptyState } from '@/components/shared/EmptyState'
import { Construction } from 'lucide-react'

export function TransportPlaceholder({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <EmptyState
        icon={Construction}
        title={`${title} coming soon`}
        description="This section will be built in a follow-up step."
      />
    </div>
  )
}