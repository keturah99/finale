import { Input } from '@/components/ui/input'

export function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: string
  to: string
  onChange: (range: { from: string; to: string }) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        value={from}
        onChange={(e) => onChange({ from: e.target.value, to })}
        className="w-40"
      />
      <span className="text-sm text-slate-400">to</span>
      <Input
        type="date"
        value={to}
        onChange={(e) => onChange({ from, to: e.target.value })}
        className="w-40"
      />
    </div>
  )
}