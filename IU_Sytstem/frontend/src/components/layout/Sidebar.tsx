import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Truck,
  Wallet,
  Store,
  BarChart3,
  Users,
  Warehouse,
  ClipboardList,
  FlaskConical,
  ExternalLink,
  ClipboardCheck,
  Banknote,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRole } from '@/hooks/useRole'

interface NavItem {
  label: string
  to: string
  icon: React.ComponentType<{ className?: string }>
  roles?: string[]
}

const NAV: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  {
    label: 'Inventory', to: '/inventory', icon: Package,
    roles: ['inventory_manager', 'inventory_clerk'],
  },
  {
    label: 'Production', to: '/supply-chain/production', icon: FlaskConical,
    roles: ['supply_chain_officer'],
  },
  {
    label: 'Supply Chain', to: '/supply-chain', icon: Warehouse,
    roles: ['supply_chain_officer'],
  },
  {
    label: 'Transport', to: '/transport', icon: Truck,
    roles: ['transport_manager', 'transport_clerk'],
  },
  {
    label: 'Wholesale', to: '/wholesale', icon: Store,
    roles: ['wholesale_manager', 'wholesale_clerk', 'cashier'],
  },
  {
    label: 'Cashier', to: '/cashier', icon: Banknote,
    roles: ['cashier'],
  },
  {
    label: 'Finance', to: '/finance', icon: ClipboardCheck,
    roles: ['finance_officer', 'finance_manager'],
  },
  {
    label: 'Payroll', to: '/payroll', icon: Wallet,
    roles: ['payroll_officer'],
  },
  {
    label: 'Reporting', to: '/reporting', icon: BarChart3,
    roles: [
      'reporting_analyst', 'inventory_manager', 'transport_manager',
      'supply_chain_officer', 'wholesale_manager', 'payroll_officer',
      'finance_officer', 'finance_manager', 'auditor',
    ],
  },
  { label: 'Admin', to: '/admin', icon: Users },
]

export function Sidebar() {
  const { hasAnyRole, isSuperuser } = useRole()

  const visibleItems = NAV.filter((item) => {
    if (item.to === '/admin') return isSuperuser
    if (!item.roles) return true
    return isSuperuser || hasAnyRole(item.roles)
  })

  return (
    <aside className="hidden w-60 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5 dark:border-slate-700">
        <ClipboardList className="h-6 w-6 text-brand-500 dark:text-brand-400" />
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          IU System
        </span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition',
                isActive
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-3 dark:border-slate-700">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          External
        </p>
        <a
          href="/book"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <span className="flex items-center gap-3">
            <ExternalLink className="h-4 w-4" />
            Public Portal
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">↗</span>
        </a>
      </div>
    </aside>
  )
}