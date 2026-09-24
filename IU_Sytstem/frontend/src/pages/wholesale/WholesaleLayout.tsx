import { NavLink, Outlet } from 'react-router-dom'
import {
  Store,
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  AlertTriangle,
  CalendarDays,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'

const TABS = [
  { label: 'Outlets', to: 'outlets', icon: Store },
  { label: 'Stock', to: 'stock', icon: Boxes },
  { label: 'Stock In', to: 'stock-in', icon: ArrowDownToLine },
  { label: 'Stock Out', to: 'stock-out', icon: ArrowUpFromLine },
  { label: 'Transfers', to: 'transfers', icon: ArrowLeftRight },
  { label: 'Damages', to: 'damages', icon: AlertTriangle },
  { label: 'Weekly Sales', to: 'weekly-sales', icon: CalendarDays },
]

export function WholesaleLayout() {
  return (
    <div>
      <PageHeader
        title="Wholesale"
        description="Manage outlets, stock, transfers, and weekly sales"
      />

      <div className="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition',
                isActive
                  ? 'border-brand-500 text-brand-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900',
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