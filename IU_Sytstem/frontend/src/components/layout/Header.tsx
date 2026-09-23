import { useNavigate } from 'react-router-dom'
import { LogOut, User as UserIcon } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { userFullName } from '@/lib/format'

export function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="text-sm text-slate-500">
        Integrated Unified System
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <UserIcon className="h-4 w-4 text-slate-400" />
          <span className="font-medium text-slate-800">
            {userFullName(user)}
          </span>
          {user?.department && (
            <span className="text-xs text-slate-400">
              · {user.department.name}
            </span>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </header>
  )
}