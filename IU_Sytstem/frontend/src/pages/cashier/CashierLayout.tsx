import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'

const TABS = [
  { label: 'Dashboard', to: 'dashboard', icon: LayoutDashboard },
  { label: 'My Submissions', to: 'my-submissions', icon: FileText },
]

export function CashierLayout() {
  return (
    <div>
      <PageHeader
        title="Cashier"
        description="Record cash-ins and track finance review status"
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
                  ? 'border-brand-500 text-brand-700 dark:text-brand-400'
                  : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100',
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