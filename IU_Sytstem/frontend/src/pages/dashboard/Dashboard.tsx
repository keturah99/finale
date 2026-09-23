import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { userFullName } from '@/lib/format'
import { useAuth } from '@/hooks/useAuth'

interface DashboardData {
  inventory?: { products: number; stock_value: number; unresolved_alerts: number }
  supply_chain?: Record<string, unknown>
  transport?: Record<string, unknown>
  payroll?: Record<string, unknown>
}

export function Dashboard() {
  const { user } = useAuth()
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get('/api/reporting/dashboard/')).data,
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">
          Welcome, {userFullName(user)}
        </h1>
        <p className="text-sm text-slate-500">
          Here's your operational overview.
        </p>
      </div>

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}

      {data?.inventory && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card label="Products" value={String(data.inventory.products)} />
          <Card
            label="Stock Value"
            value={`K ${data.inventory.stock_value.toLocaleString()}`}
          />
          <Card
            label="Low Stock Alerts"
            value={String(data.inventory.unresolved_alerts)}
          />
        </div>
      )}
    </div>
  )
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-800">{value}</p>
    </div>
  )
}