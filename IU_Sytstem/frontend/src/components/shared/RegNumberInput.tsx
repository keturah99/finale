import { useEffect, useState } from 'react'
import { Input, type InputProps } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const REG_RE = /^[A-Z]{3} \d{4}$/

function formatRegNumber(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const letters = cleaned.match(/^[A-Z]{0,3}/)?.[0] ?? ''
  const digits = cleaned.slice(letters.length).match(/^\d{0,4}/)?.[0] ?? ''
  if (digits.length === 0) return letters
  return `${letters} ${digits}`
}

export interface RegNumberInputProps
  extends Omit<InputProps, 'value' | 'onChange' | 'label'> {
  value: string
  onChange: (value: string) => void
  label?: string
  required?: boolean
  showValidation?: boolean
  containerClassName?: string
}

export function RegNumberInput({
  value,
  onChange,
  label,
  required,
  showValidation = true,
  containerClassName,
  ...props
}: RegNumberInputProps) {
  const [local, setLocal] = useState(value)

  useEffect(() => {
    setLocal(value)
  }, [value])

  const isValid = REG_RE.test(local)
  const showError = showValidation && local.length > 0 && !isValid

  return (
    <div className={cn('w-full', containerClassName)}>
      {label && <Label required={required}>{label}</Label>}
      <Input
        {...props}
        value={local}
        error={showError}
        placeholder={props.placeholder ?? 'ABC 1234'}
        maxLength={8}
        onChange={(e) => {
          const formatted = formatRegNumber(e.target.value)
          setLocal(formatted)
          onChange(formatted)
        }}
      />
      {showValidation && local.length > 0 && (
        <p
          className={cn(
            'mt-1 text-xs',
            isValid
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-red-600 dark:text-red-400',
          )}
        >
          {isValid ? 'Valid registration number' : 'Format: ABC 1234'}
        </p>
      )}
    </div>
  )
}