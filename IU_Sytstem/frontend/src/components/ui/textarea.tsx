import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'min-h-[80px] w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition',
        'placeholder:text-slate-400',
        'focus:border-brand-500 focus:ring-1 focus:ring-brand-500',
        error ? 'border-red-400' : 'border-slate-300',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'