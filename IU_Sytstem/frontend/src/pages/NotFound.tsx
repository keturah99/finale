import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center py-16">
      <p className="text-5xl font-bold text-slate-300">404</p>
      <p className="mt-2 text-slate-600 dark:text-slate-300">Page not found</p>
      <Link
        to="/dashboard"
        className="mt-4 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
      >
        Back to Dashboard
      </Link>
    </div>
  )
}