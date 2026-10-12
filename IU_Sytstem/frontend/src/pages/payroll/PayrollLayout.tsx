import { NavLink, Outlet } from 'react-router-dom'
import { Wallet, PlayCircle, FileText, FileSpreadsheet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'

const TABS = [
  { label: 'Salaries', to: 'salaries', icon: Wallet },
  { label: 'Payroll Runs', to: 'runs', icon: PlayCircle },
  { label: 'My Payslips', to: 'payslips', icon: FileText },
  { label: 'Bank Exports', to: 'bank-exports', icon: FileSpreadsheet },
]

export function PayrollLayout() {
  return (
    <div>
      <PageHeader
        title="Payroll"
        description="Salaries, runs, payslips, and bank exports"
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