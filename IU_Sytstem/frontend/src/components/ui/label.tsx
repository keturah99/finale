import { cn } from '@/lib/utils'

export function Label({
  className,
  required,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label
      className={cn(
        'mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300',
        className,
      )}
      {...props}
    >
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  )
}