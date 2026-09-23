import { useRef, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useClickOutside } from '@/hooks/useClickOutside'
import type { FieldError } from 'react-hook-form'

export interface ComboboxOption {
  value: string | number
  label: string
}

export interface FormComboboxProps {
  label?: string
  error?: FieldError | string
  required?: boolean
  options: ComboboxOption[]
  value: string | number | null
  onChange: (value: string | number | null) => void
  placeholder?: string
  emptyText?: string
  containerClassName?: string
}

export function FormCombobox({
  label,
  error,
  required,
  options,
  value,
  onChange,
  placeholder = 'Select…',
  emptyText = 'No matches',
  containerClassName,
}: FormComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false), open)

  const errorMessage = typeof error === 'string' ? error : error?.message
  const selected = options.find((o) => o.value === value)
  const filtered = query
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase()),
      )
    : options

  return (
    <div className={cn('w-full', containerClassName)} ref={ref}>
      {label && <Label required={required}>{label}</Label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-md border bg-white px-3 text-left text-sm outline-none transition',
            'focus:border-brand-500 focus:ring-1 focus:ring-brand-500',
            errorMessage ? 'border-red-400' : 'border-slate-300',
          )}
        >
          <span className={cn('truncate', !selected && 'text-slate-400')}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>

        {open && (
          <div className="absolute z-30 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
            <div className="border-b border-slate-100 p-1.5">
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type to filter…"
                className="h-8 text-xs"
              />
            </div>
            <div className="max-h-60 overflow-auto py-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-sm text-slate-500">{emptyText}</p>
              ) : (
                filtered.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      onChange(o.value)
                      setQuery('')
                      setOpen(false)
                    }}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                  >
                    <span>{o.label}</span>
                    {value === o.value && (
                      <Check className="h-4 w-4 text-brand-500" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      {errorMessage && (
        <p className="mt-1 text-xs text-red-600">{errorMessage}</p>
      )}
    </div>
  )
}