import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-9 w-full rounded-md border bg-white px-3 text-sm outline-none transition',
        'focus:border-brand-500 focus:ring-1 focus:ring-brand-500',
        'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
        error ? 'border-red-400' : 'border-slate-300',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
)
Select.displayName = 'Select'