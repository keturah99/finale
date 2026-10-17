import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ClipboardList } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

type FormValues = z.infer<typeof schema>

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: { pathname: string } } }
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    setLoading(true)
    try {
      await login(values.username, values.password)
      toast.success('Welcome back')
      navigate(location.state?.from?.pathname ?? '/dashboard', { replace: true })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Login failed. Check your credentials.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-800/50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-6 flex flex-col items-center">
          <ClipboardList className="mb-2 h-10 w-10 text-brand-500 dark:text-brand-400" />
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Integrated Unified System
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Sign in to continue
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Username
            </label>
            <input
              type="text"
              autoComplete="username"
              autoFocus
              {...register('username')}
              className={cn(
                'w-full rounded-md border bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none transition',
                'text-slate-900 dark:text-slate-100 placeholder:text-slate-400',
                'focus:border-brand-500 focus:ring-1 focus:ring-brand-500',
                'dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500',
                errors.username
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-slate-300 dark:border-slate-600',
              )}
            />
            {errors.username && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {errors.username.message}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              {...register('password')}
              className={cn(
                'w-full rounded-md border bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none transition',
                'text-slate-900 dark:text-slate-100 placeholder:text-slate-400',
                'focus:border-brand-500 focus:ring-1 focus:ring-brand-500',
                'dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500',
                errors.password
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-slate-300 dark:border-slate-600',
              )}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}