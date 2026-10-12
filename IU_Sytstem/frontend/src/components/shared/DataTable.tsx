import { useMemo } from 'react'
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_RowData,
  type MRT_TableOptions,
} from 'material-react-table'
import { useTheme } from '@mui/material/styles'

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
  const muiTheme = useTheme()
  const isDark = muiTheme.palette.mode === 'dark'

  const memoColumns = useMemo(() => columns, [columns])
  const memoData = useMemo(() => data, [data])

  const borderColor = isDark ? '#334155' : '#e2e8f0'
  const headBg = isDark ? '#0f172a' : '#f8fafc'
  const headText = isDark ? '#94a3b8' : '#64748b'
  const bodyText = isDark ? '#cbd5e1' : '#334155'
  const rowHoverBg = isDark ? '#1e293b' : '#f8fafc'

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
        border: `1px solid ${borderColor}`,
        borderRadius: '0.5rem',
        overflow: 'hidden',
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
      },
    },
    muiTableHeadCellProps: {
      sx: {
        backgroundColor: headBg,
        fontSize: '0.75rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: headText,
        borderBottom: `1px solid ${borderColor}`,
      },
    },
    muiTableBodyCellProps: {
      sx: { fontSize: '0.875rem', color: bodyText },
    },
    muiTableBodyRowProps: ({ row }) => ({
      onClick: onRowClick ? () => onRowClick(row.original) : undefined,
      sx: onRowClick
        ? { cursor: 'pointer', '&:hover': { backgroundColor: rowHoverBg } }
        : undefined,
    }),
    muiTopToolbarProps: { sx: { backgroundColor: 'transparent' } },
    muiBottomToolbarProps: {
      sx: {
        backgroundColor: 'transparent',
        borderTop: `1px solid ${borderColor}`,
      },
    },
    muiSearchTextFieldProps: {
      sx: {
        '& .MuiInputBase-root': {
          color: isDark ? '#f1f5f9' : undefined,
        },
      },
    },
    muiPaginationProps: {
      sx: {
        color: isDark ? '#cbd5e1' : undefined,
        '& .Mui-disabled': { color: isDark ? '#475569' : undefined },
      },
    },
    muiTableContainerProps: {
      sx: { backgroundColor: 'transparent' },
    },
    renderEmptyRowsFallback: () => (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {emptyTitle}
        </p>
        {emptyDescription && (
          <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            {emptyDescription}
          </p>
        )}
      </div>
    ),
    ...tableOptions,
  })

  return <MaterialReactTable table={table} />
}