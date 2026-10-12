import { useMemo } from 'react'
import type { MRT_ColumnDef } from 'material-react-table'
import { DataTable } from '@/components/shared/DataTable'
import { useCrops } from '@/hooks/queries/useSupplyChain'
import type { Crop } from '@/types/supplychain'

export function CropsPage() {
  const { data: crops = [], isLoading } = useCrops()

  const columns = useMemo<MRT_ColumnDef<Crop>[]>(
    () => [
      { accessorKey: 'code', header: 'Code', size: 120,
        Cell: ({ row }) => (
          <span className="font-mono text-sm font-semibold text-slate-800">
            {row.original.name.toUpperCase()}
          </span>
        ),
      },
      { accessorKey: 'display_name', header: 'Crop', size: 200 },
      { accessorKey: 'unit', header: 'Unit', size: 100 },
    ],
    [],
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Fixed list of crops the company buys. Managed via backend seed — not editable from here.
      </p>

      <DataTable
        columns={columns}
        data={crops}
        isLoading={isLoading}
        emptyTitle="No crops configured"
        emptyDescription="Run the backend seed to load crops."
      />
    </div>
  )
}