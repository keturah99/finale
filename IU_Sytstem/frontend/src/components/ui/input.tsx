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
        'placeholder:text-slate-400',
        'focus:border-brand-500 focus:ring-1 focus:ring-brand-500',
        'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
        error ? 'border-red-400' : 'border-slate-300',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'