import { useEffect, useState } from 'react'
import { Input, type InputProps } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface CurrencyInputProps
  extends Omit<InputProps, 'value' | 'onChange' | 'type' | 'label'> {
  value: string | number
  onChange: (value: string) => void
  label?: string
  required?: boolean
  currency?: string
  containerClassName?: string
}

function parseNumeric(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '')
  const [whole = '', ...rest] = cleaned.split('.')
  const decimals = rest.join('').slice(0, 2)
  if (rest.length === 0) return whole
  return `${whole}.${decimals}`
}

export function CurrencyInput({
  value,
  onChange,
  label,
  required,
  currency = 'K',
  containerClassName,
  ...props
}: CurrencyInputProps) {
  const [local, setLocal] = useState(String(value ?? ''))

  useEffect(() => {
    setLocal(String(value ?? ''))
  }, [value])

  return (
    <div className={cn('w-full', containerClassName)}>
      {label && <Label required={required}>{label}</Label>}
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
          {currency}
        </span>
        <Input
          {...props}
          value={local}
          type="text"
          inputMode="decimal"
          className="pl-8"
          onChange={(e) => {
            const parsed = parseNumeric(e.target.value)
            setLocal(parsed)
            onChange(parsed)
          }}
        />
      </div>
    </div>
  )
}