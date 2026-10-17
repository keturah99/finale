import { useMemo, useState } from 'react'
import type { MRT_ColumnDef } from 'material-react-table'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { FormField } from '@/components/forms/FormField'
import { FormSelect } from '@/components/forms/FormSelect'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { DataTable } from '@/components/shared/DataTable'
import { FilterBar } from '@/components/shared/FilterBar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { WriteOnly } from '@/components/guards/WriteOnly'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownItem, DropdownSeparator,
} from '@/components/ui/dropdown-menu'

import {
  useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct,
} from '@/hooks/queries/useInventory'
import { useIsReadOnly } from '@/hooks/useIsReadOnly'
import { formatK } from '@/lib/format'
import type { Product, ProductFormData, Department } from '@/types/inventory'

const schema = z.object({
  sku: z.string().min(1, 'SKU required').max(50),
  name: z.string().min(1, 'Name required').max(150),
  department: z.enum(['groceries', 'household', 'hardware', 'production']),
  category: z.string().max(80).optional(),
  unit_price: z.string().min(1, 'Price required'),
  reorder_level: z.number().int().min(0),
  is_active: z.boolean(),
})

type Form = z.infer<typeof schema>

const DEPT_OPTIONS = [
  { value: 'groceries', label: 'Groceries' },
  { value: 'household', label: 'Household' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'production', label: 'Production' },
]

export function ProductsPage() {
  const isReadOnly = useIsReadOnly()

  const [deptFilter, setDeptFilter] = useState('')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null)

  const { data: products = [], isLoading } = useProducts(
    deptFilter ? { department: deptFilter } : undefined,
  )
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct(editing?.id ?? 0)
  const deleteProduct = useDeleteProduct()

  const filtered = useMemo(() => {
    if (!search) return products
    const q = search.toLowerCase()
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    )
  }, [products, search])

  const columns = useMemo<MRT_ColumnDef<Product>[]>(() => {
    const base: MRT_ColumnDef<Product>[] = [
      { accessorKey: 'sku', header: 'SKU', size: 120,
        Cell: ({ cell }) => (
          <span className="font-mono text-sm font-semibold">
            {cell.getValue<string>()}
          </span>
        ) },
      { accessorKey: 'name', header: 'Product' },
      { accessorKey: 'department', header: 'Department', size: 130,
        Cell: ({ cell }) => (
          <StatusBadge
            status={cell.getValue<string>()}
            label={cell.getValue<string>()}
          />
        ) },
      { accessorKey: 'category', header: 'Category', size: 140,
        Cell: ({ cell }) => cell.getValue<string>() || '—' },
      { accessorKey: 'unit_price', header: 'Price', size: 120,
        Cell: ({ cell }) => formatK(cell.getValue<string>()) },
      { id: 'stock', header: 'On Hand', size: 100,
        Cell: ({ row }) => {
          const qty = row.original.stock?.quantity_on_hand ?? 0
          const low = qty <= row.original.reorder_level
          return (
            <span className={low ? 'font-semibold text-amber-600' : 'font-semibold text-slate-800 dark:text-slate-100'}>
              {qty}
            </span>
          )
        } },
      { accessorKey: 'reorder_level', header: 'Reorder At', size: 110 },
      { id: 'status', header: 'Status', size: 100,
        Cell: ({ row }) => (
          <StatusBadge status={row.original.is_active ? 'active' : 'inactive'} />
        ) },
    ]

    if (!isReadOnly) {
      base.push({
        id: 'actions',
        header: '',
        size: 60,
        enableSorting: false,
        enableColumnFilter: false,
        Cell: ({ row }) => (
          <DropdownMenu
            trigger={
              <span className="cursor-pointer rounded p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700">
                •••
              </span>
            }
          >
            <DropdownItem
              onClick={() => {
                setEditing(row.original)
                setDialogOpen(true)
              }}
            >
              <span className="flex items-center gap-2">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </span>
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem
              destructive
              onClick={() => setConfirmDelete(row.original)}
            >
              <span className="flex items-center gap-2">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </span>
            </DropdownItem>
          </DropdownMenu>
        ),
      })
    }

    return base
  }, [isReadOnly])

  const handleSave = async (data: Form) => {
    try {
      const payload = data as ProductFormData
      if (editing) {
        await updateProduct.mutateAsync(payload)
        toast.success('Product updated')
      } else {
        await createProduct.mutateAsync(payload)
        toast.success('Product created')
      }
      setDialogOpen(false)
      setEditing(null)
    } catch (err) {
      const msg = (err as { response?: { data?: unknown } })?.response?.data
      toast.error(msg ? JSON.stringify(msg) : 'Save failed')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Central product catalogue shared by all modules.
        </p>
        <WriteOnly>
          <Button onClick={() => { setEditing(null); setDialogOpen(true) }}>
            <Plus className="h-4 w-4" /> New Product
          </Button>
        </WriteOnly>
      </div>

      <FilterBar
        active={Boolean(deptFilter || search)}
        onClear={() => { setDeptFilter(''); setSearch('') }}
      >
        <Select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="w-48"
        >
          <option value="">All departments</option>
          {DEPT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
        <Input
          placeholder="Search SKU or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
      </FilterBar>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        emptyTitle="No products yet"
        emptyDescription="Click 'New Product' to build your catalogue."
      />

      {dialogOpen && (
        <ProductDialog
          key={editing?.id ?? 'new'}
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setEditing(null) }}
          onSubmit={handleSave}
          initial={editing}
          loading={createProduct.isPending || updateProduct.isPending}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return
          try {
            await deleteProduct.mutateAsync(confirmDelete.id)
            toast.success('Product deleted')
          } catch { toast.error('Delete failed') }
        }}
        title="Delete this product?"
        description={confirmDelete ? `"${confirmDelete.name}" will be removed.` : ''}
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  )
}

function ProductDialog({
  open, onClose, onSubmit, initial, loading,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (d: Form) => void | Promise<void>
  initial: Product | null
  loading: boolean
}) {
  const { register, handleSubmit, control, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      sku: initial?.sku ?? '',
      name: initial?.name ?? '',
      department: (initial?.department ?? 'groceries') as Department,
      category: initial?.category ?? '',
      unit_price: initial?.unit_price ?? '',
      reorder_level: initial?.reorder_level ?? 10,
      is_active: initial?.is_active ?? true,
    },
  })

  return (
    <Dialog open={open} onClose={onClose}
      title={initial ? 'Edit product' : 'New product'} className="max-w-lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="SKU" required placeholder="GRC-001" error={errors.sku} {...register('sku')} />
          <FormField label="Name" required placeholder="Maize Meal 25kg" error={errors.name} {...register('name')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormSelect label="Department" required options={DEPT_OPTIONS}
            error={errors.department} {...register('department')} />
          <FormField label="Category" placeholder="e.g. Staples" error={errors.category} {...register('category')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Controller name="unit_price" control={control} render={({ field }) => (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Unit Price <span className="text-red-500">*</span>
              </label>
              <CurrencyInput value={field.value} onChange={field.onChange}
                error={Boolean(errors.unit_price)} />
              {errors.unit_price && <p className="mt-1 text-xs text-red-600">{errors.unit_price.message}</p>}
            </div>
          )} />
          <FormField label="Reorder Level" required type="number"
            error={errors.reorder_level}
            {...register('reorder_level', { valueAsNumber: true })} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register('is_active')} />
          Active
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving…' : initial ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}