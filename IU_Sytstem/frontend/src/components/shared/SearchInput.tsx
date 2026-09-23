import { Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/useDebounce'

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  delay = 300,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  delay?: number
}) {
  const [local, setLocal] = useState(value)
  const debounced = useDebounce(local, delay)

  useEffect(() => {
    if (debounced !== value) onChange(debounced)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  useEffect(() => {
    if (value !== local) setLocal(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <div className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-8"
      />
      {local && (
        <button
          type="button"
          onClick={() => setLocal('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}