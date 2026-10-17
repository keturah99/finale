import { useEffect, useState } from 'react'
import { Input, type InputProps } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const NRC_RE = /^\d{6}\/\d{2}\/\d$/

/**
 * Format an NRC input string as the user types.
 *
 *   '123456789'    -> '123456/78/9'
 *   '123456'       -> '123456'
 *   '12345678'     -> '123456/78'
 *   '123456/78/9'  -> '123456/78/9'
 */
function formatNrc(raw: string): string {
  // Keep digits only, cap at 9
  const digits = raw.replace(/\D/g, '').slice(0, 9)

  const part1 = digits.slice(0, 6)
  const part2 = digits.slice(6, 8)
  const part3 = digits.slice(8, 9)

  let out = part1
  if (part2) out += '/' + part2
  if (part3) out += '/' + part3
  return out
}

export interface NrcInputProps
  extends Omit<InputProps, 'value' | 'onChange' | 'label'> {
  value: string
  onChange: (value: string) => void
  label?: string
  required?: boolean
  showValidation?: boolean
  containerClassName?: string
}

export function NrcInput({
  value,
  onChange,
  label,
  required,
  showValidation = true,
  containerClassName,
  ...props
}: NrcInputProps) {
  const [local, setLocal] = useState(value)

  useEffect(() => {
    setLocal(value)
  }, [value])

  const isValid = NRC_RE.test(local)
  const showError = showValidation && local.length > 0 && !isValid

  return (
    <div className={cn('w-full', containerClassName)}>
      {label && <Label required={required}>{label}</Label>}
      <Input
        {...props}
        value={local}
        error={showError}
        placeholder={props.placeholder ?? '123456/78/9'}
        maxLength={11}
        inputMode="numeric"
        onChange={(e) => {
          const formatted = formatNrc(e.target.value)
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
          {isValid ? 'Valid NRC number' : 'Format: 123456/78/9'}
        </p>
      )}
    </div>
  )
}