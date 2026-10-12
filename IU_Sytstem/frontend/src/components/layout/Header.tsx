
import { useIsReadOnly } from '@/hooks/useIsReadOnly'


import { useNavigate } from 'react-router-dom'
import { LogOut, User as UserIcon, Sun, Moon } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { userFullName } from '@/lib/format'

export function Header() {
  const { user, logout } = useAuth()
  const { resolved, toggle } = useTheme()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-700 dark:bg-slate-900">
      <div className="text-sm text-slate-500 dark:text-slate-400">
        Integrated Unified System
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={toggle}
          aria-label={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          {resolved === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>

        <div className="flex items-center gap-2 text-sm">
          <UserIcon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          <span className="font-medium text-slate-800 dark:text-slate-200">
            {userFullName(user)}
          </span>
          {user?.department && (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              · {user.department.name}
            </span>
          )}
          {user?.wholesale && (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              · {user.wholesale.name}
            </span>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </header>
  )
}


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
        <h1 className="text-2xl font-semibold text-slate-800">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>
      {actions && !isReadOnly && (
        <div className="flex items-center gap-2">{actions}</div>
      )}
    </div>
  )
}