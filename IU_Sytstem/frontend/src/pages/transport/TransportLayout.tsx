import { NavLink, Outlet } from 'react-router-dom'
import { Truck, Users, Container, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'

const TABS = [
  { label: 'Bookings', to: 'bookings', icon: ClipboardList },
  { label: 'Vehicles', to: 'vehicles', icon: Truck },
  { label: 'Drivers', to: 'drivers', icon: Users },
  { label: 'Trailers', to: 'trailers', icon: Container },
]

export function TransportLayout() {
  return (
    <div>
      <PageHeader
        title="Transport"
        description="Manage vehicles, drivers, trailers, and dispatch"
      />

      <div className="mb-6 flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition',
                isActive
                  ? 'border-brand-500 text-brand-700'
                  : 'border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900',
              )
            }
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  )
}