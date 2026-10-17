import { NavLink, Outlet } from 'react-router-dom'
import { Package, ArrowLeftRight, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'

const TABS = [
  { label: 'Products', to: 'products', icon: Package },
  { label: 'Movements', to: 'movements', icon: ArrowLeftRight },
  { label: 'Alerts', to: 'alerts', icon: AlertTriangle },
]

export function InventoryLayout() {
  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Products, stock movements, and low-stock alerts"
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