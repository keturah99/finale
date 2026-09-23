import { forwardRef } from 'react'
import type { FieldError } from 'react-hook-form'
import { Select, type SelectProps } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface FormSelectProps extends SelectProps {
  label?: string
  error?: FieldError | string
  required?: boolean
  options: Array<{ value: string | number; label: string }>
  placeholder?: string
  containerClassName?: string
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  (
    { label, error, required, options, placeholder, containerClassName, ...props },
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
        <Select ref={ref} error={Boolean(errorMessage)} {...props}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        {errorMessage && (
          <p className="mt-1 text-xs text-red-600">{errorMessage}</p>
        )}
      </div>
    )
  },
)
FormSelect.displayName = 'FormSelect'