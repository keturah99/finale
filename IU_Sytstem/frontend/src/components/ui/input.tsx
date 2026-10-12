import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-md border bg-white px-3 text-sm outline-none transition',
        'text-slate-900 placeholder:text-slate-400',
        'focus:border-brand-500 focus:ring-1 focus:ring-brand-500',
        'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
        'dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500',
        'dark:disabled:bg-slate-900 dark:disabled:text-slate-500',
        error
          ? 'border-red-400 dark:border-red-500'
          : 'border-slate-300 dark:border-slate-600',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'