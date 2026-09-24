import { useMemo, useState } from 'react'
import type { MRT_ColumnDef } from 'material-react-table'
import { Boxes, TrendingDown, Wallet } from 'lucide-react'

import { DataTable } from '@/components/shared/DataTable'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { FilterBar } from '@/components/shared/FilterBar'
import { useOutlets, useStockLevels } from '@/hooks/queries/useWholesale'
import { formatK, formatDateTime } from '@/lib/format'
import type { StockLevel } from '@/types/wholesale'

export function StockLevelsPage() {
  const [wholesaleFilter, setWholesaleFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [lowOnly, setLowOnly] = useState(false)

  const { data: outlets = [] } = useOutlets()

  const { data: levels = [], isLoading } = useStockLevels(
    wholesaleFilter ? { wholesale: Number(wholesaleFilter) } : undefined,
  )

  // Client-side filtering (search + low stock threshold)
  const filtered = useMemo(() => {
    return levels.filter((l) => {
      if (search) {
        const q = search.toLowerCase()
        if (
          !l.product_name.toLowerCase().includes(q) &&
          !l.product_sku.toLowerCase().includes(q)
        ) {
          return false
        }
      }
      if (lowOnly && l.quantity > 20) return false
      return true
    })
  }, [levels, search, lowOnly])

  // Aggregate stats
  const stats = useMemo(() => {
    const totalUnits = filtered.reduce((sum, l) => sum + l.quantity, 0)
    const totalValue = filtered.reduce(
      (sum, l) => sum + Number(l.total_value || 0),
      0,
    )
    const lowCount = filtered.filter((l) => l.quantity <= 20 && l.quantity > 0).length
    return { totalUnits, totalValue, lowCount }
  }, [filtered])

  const columns = useMemo<MRT_ColumnDef<StockLevel>[]>(
    () => [
      { accessorKey: 'product_sku', header: 'SKU', size: 120 },
      { accessorKey: 'product_name', header: 'Product' },
      {
        accessorKey: 'quantity',
        header: 'On Hand',
        size: 110,
        Cell: ({ cell }) => {
          const qty = cell.getValue<number>()
          const color =
            qty <= 0
              ? 'text-red-600 font-semibold'
              : qty <= 20
                ? 'text-amber-600 font-semibold'
                : 'text-slate-800 font-semibold'
          return <span className={color}>{qty.toLocaleString()}</span>
        },
      },
      {
        accessorKey: 'average_cost',
        header: 'Avg Cost',
        size: 120,
        Cell: ({ cell }) => formatK(cell.getValue<string>()),
      },
      {
        accessorKey: 'total_value',
        header: 'Total Value',
        size: 140,
        Cell: ({ cell }) => formatK(cell.getValue<string>()),
      },
      {
        accessorKey: 'last_updated',
        header: 'Last Updated',
        size: 160,
        Cell: ({ cell }) => formatDateTime(cell.getValue<string>()),
      },
    ],
    [],
  )

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={Boxes}
          label="Total Units"
          value={stats.totalUnits.toLocaleString()}
        />
        <StatCard
          icon={Wallet}
          label="Stock Value"
          value={formatK(stats.totalValue)}
        />
        <StatCard
          icon={TrendingDown}
          label="Low Stock Items"
          value={String(stats.lowCount)}
          tone={stats.lowCount > 0 ? 'warning' : 'default'}
        />
      </div>

      <FilterBar active={Boolean(wholesaleFilter || search || lowOnly)}
        onClear={() => {
          setWholesaleFilter('')
          setSearch('')
          setLowOnly(false)
        }}
      >
        <Select
          value={wholesaleFilter}
          onChange={(e) => setWholesaleFilter(e.target.value)}
          className="w-56"
        >
          <option value="">All outlets</option>
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>

        <Input
          placeholder="Search SKU or product…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(e) => setLowOnly(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Low stock only
        </label>
      </FilterBar>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        emptyTitle="No stock at this outlet"
        emptyDescription="Record a Stock In entry to add inventory."
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  tone?: 'default' | 'warning'
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <Icon
          className={
            tone === 'warning' ? 'h-4 w-4 text-amber-500' : 'h-4 w-4 text-slate-400'
          }
        />
        <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-800">{value}</p>
    </div>
  )
}