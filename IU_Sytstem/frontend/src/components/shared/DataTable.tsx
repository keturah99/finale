import { useMemo } from 'react'
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_RowData,
  type MRT_TableOptions,
} from 'material-react-table'

interface DataTableProps<T extends MRT_RowData> {
  columns: MRT_ColumnDef<T>[]
  data: T[]
  isLoading?: boolean
  emptyTitle?: string
  emptyDescription?: string
  onRowClick?: (row: T) => void
  enableRowSelection?: boolean
  tableOptions?: Partial<MRT_TableOptions<T>>
}

export function DataTable<T extends MRT_RowData>({
  columns,
  data,
  isLoading,
  emptyTitle = 'No data',
  emptyDescription = 'Nothing to show here yet.',
  onRowClick,
  enableRowSelection = false,
  tableOptions,
}: DataTableProps<T>) {
  const memoColumns = useMemo(() => columns, [columns])
  const memoData = useMemo(() => data, [data])

  const table = useMaterialReactTable({
    columns: memoColumns,
    data: memoData,
    state: { isLoading },
    enableRowSelection,
    enableColumnActions: false,
    enableColumnFilters: true,
    enableSorting: true,
    enablePagination: true,
    enableDensityToggle: true,
    enableFullScreenToggle: false,
    enableHiding: true,
    enableGlobalFilter: true,
    enableColumnResizing: true,
    layoutMode: 'grid-no-grow',
    initialState: {
      pagination: { pageSize: 15, pageIndex: 0 },
      density: 'compact',
      showGlobalFilter: true,
    },
    muiTablePaperProps: {
      elevation: 0,
      sx: {
        border: '1px solid #e2e8f0',
        borderRadius: '0.5rem',
        overflow: 'visible',
      },
    },
    muiTableHeadCellProps: {
      sx: {
        backgroundColor: '#f8fafc',
        fontSize: '0.75rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: '#64748b',
        borderBottom: '1px solid #e2e8f0',
      },
    },
    muiTableBodyCellProps: {
      sx: { fontSize: '0.875rem', color: '#334155' },
    },
    muiTableBodyRowProps: ({ row }) => ({
      onClick: onRowClick ? () => onRowClick(row.original) : undefined,
      sx: onRowClick
        ? { cursor: 'pointer', '&:hover': { backgroundColor: '#f8fafc' } }
        : undefined,
    }),
    muiTopToolbarProps: {
      sx: { backgroundColor: 'transparent' },
    },
    muiBottomToolbarProps: {
      sx: { backgroundColor: 'transparent', borderTop: '1px solid #e2e8f0' },
    },
    renderEmptyRowsFallback: () => (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm font-medium text-slate-700">{emptyTitle}</p>
        {emptyDescription && (
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            {emptyDescription}
          </p>
        )}
      </div>
    ),
    ...tableOptions,
  })

  return <MaterialReactTable table={table} />
}