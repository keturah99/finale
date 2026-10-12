import { forwardRef } from 'react'
import type { FieldError } from 'react-hook-form'
import { Input, type InputProps } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface FormFieldProps extends Omit<InputProps, 'error'> {
  label?: string
  error?: FieldError | string
  description?: string
  required?: boolean
  containerClassName?: string
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  (
    { label, error, description, required, containerClassName, className, ...props },
    ref,
  ) => {
    const errorMessage = typeof error === 'string' ? error : error?.message

    return (
      <div className={cn('w-full', containerClassName)}>
        {label && (
          <Label htmlFor={props.id} required={required}>
            {label}
          </Label>
        )}
        <Input
          ref={ref}
          error={Boolean(errorMessage)}
          className={className}
          {...props}
        />
        {description && !errorMessage && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
        {errorMessage && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {errorMessage}
          </p>
        )}
      </div>
    )
  },
)
FormField.displayName = 'FormField'