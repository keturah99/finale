import { useMemo } from 'react'
import type { MRT_ColumnDef } from 'material-react-table'
import { Check } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { WriteOnly } from '@/components/guards/WriteOnly'
import { useAlerts, useResolveAlert } from '@/hooks/queries/useInventory'
import { formatDateTime } from '@/lib/format'
import type { StockAlert } from '@/types/inventory'

export function AlertsPage() {
  const { data: alerts = [], isLoading } = useAlerts()
  const resolve = useResolveAlert()

  const columns = useMemo<MRT_ColumnDef<StockAlert>[]>(
    () => [
      { accessorKey: 'created_at', header: 'Date', size: 160,
        Cell: ({ cell }) => formatDateTime(cell.getValue<string>()) },
      { accessorKey: 'product_sku', header: 'SKU', size: 120,
        Cell: ({ cell }) => (
          <span className="font-mono text-sm">{cell.getValue<string>()}</span>
        ) },
      { accessorKey: 'alert_type', header: 'Type', size: 100,
        Cell: ({ cell }) => <StatusBadge status={cell.getValue<string>()} /> },
      { accessorKey: 'message', header: 'Message' },
      { id: 'actions', header: '', size: 120,
        enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (
          <WriteOnly>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  await resolve.mutateAsync(row.original.id)
                  toast.success('Alert resolved')
                } catch { toast.error('Failed') }
              }}
            >
              <Check className="h-3.5 w-3.5" /> Resolve
            </Button>
          </WriteOnly>
        ) },
    ],
    [resolve],
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Unresolved low-stock and out-of-stock alerts across all products.
      </p>

      <DataTable columns={columns} data={alerts} isLoading={isLoading}
        emptyTitle="No active alerts"
        emptyDescription="All products are above their reorder levels." />
    </div>
  )
}