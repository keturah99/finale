import { useMemo, useRef, useState } from 'react'
import type { MRT_ColumnDef } from 'material-react-table'
import { Plus, ImageIcon, X } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { FormField } from '@/components/forms/FormField'
import { FormCombobox } from '@/components/forms/FormCombobox'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { DataTable } from '@/components/shared/DataTable'
import { FilterBar } from '@/components/shared/FilterBar'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

import {
  useOutlets,
  useDamages,
  useCreateDamage,
} from '@/hooks/queries/useWholesale'
import { useProducts } from '@/hooks/queries/useInventory'
import { formatK, formatDateTime } from '@/lib/format'
import type { Damage } from '@/types/wholesale'

// ---------------------------------------------------------------------------
// Form schema
// ---------------------------------------------------------------------------

const damageSchema = z.object({
  wholesale: z.number().int().positive(),
  product: z.number().int().positive(),
  quantity: z.number().int().positive('Quantity must be > 0'),
  selling_price: z.string().min(1, 'Selling price required'),
  notes: z.string().optional(),
})

type DamageForm = z.infer<typeof damageSchema>

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function DamagesPage() {
  const [wholesaleFilter, setWholesaleFilter] = useState('')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: outlets = [] } = useOutlets()
  const { data: products = [] } = useProducts()

  const { data: damages = [], isLoading } = useDamages(
    wholesaleFilter ? { wholesale: Number(wholesaleFilter) } : undefined,
  )

  const createDamage = useCreateDamage()

  const filtered = useMemo(
    () =>
      damages.filter((d) => {
        if (!search) return true
        return d.product_name.toLowerCase().includes(search.toLowerCase())
      }),
    [damages, search],
  )

  const columns = useMemo<MRT_ColumnDef<Damage>[]>(
    () => [
      {
        accessorKey: 'reported_at',
        header: 'Date',
        size: 160,
        Cell: ({ cell }) => formatDateTime(cell.getValue<string>()),
      },
      {
        accessorKey: 'wholesale',
        header: 'Outlet',
        size: 160,
        Cell: ({ row }) =>
          outlets.find((o) => o.id === row.original.wholesale)?.name ?? '—',
      },
      { accessorKey: 'product_name', header: 'Product' },
      {
        accessorKey: 'quantity',
        header: 'Qty',
        size: 80,
        Cell: ({ cell }) => cell.getValue<number>().toLocaleString(),
      },
      {
        accessorKey: 'selling_price',
        header: 'Unit Price',
        size: 120,
        Cell: ({ cell }) => formatK(cell.getValue<string>()),
      },
      {
        accessorKey: 'total_loss_value',
        header: 'Loss Value',
        size: 140,
        Cell: ({ cell }) => (
          <span className="font-semibold text-red-600">
            {formatK(cell.getValue<string>())}
          </span>
        ),
      },
      {
        accessorKey: 'image',
        header: 'Photo',
        size: 80,
        enableSorting: false,
        Cell: ({ cell }) => {
          const url = cell.getValue<string | null>()
          if (!url) return <span className="text-slate-400">—</span>
          return (
            <a href={url} target="_blank" rel="noreferrer">
              <img
                src={url}
                alt="damage"
                className="h-8 w-8 rounded border border-slate-200 object-cover"
              />
            </a>
          )
        },
      },
    ],
    [outlets],
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <p className="text-sm text-slate-500">
          Record damaged or lost stock. Deducts from the outlet automatically.
        </p>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Record Damage
        </Button>
      </div>

      <FilterBar
        active={Boolean(wholesaleFilter || search)}
        onClear={() => {
          setWholesaleFilter('')
          setSearch('')
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
          placeholder="Search product…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
      </FilterBar>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        emptyTitle="No damage records yet"
        emptyDescription="Click 'Record Damage' when stock is damaged or lost."
      />

      <DamageDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        outlets={outlets}
        products={products}
        onSubmit={async (data, imageFile) => {
          try {
            const formData = new FormData()
            formData.append('wholesale', String(data.wholesale))
            formData.append('product', String(data.product))
            formData.append('quantity', String(data.quantity))
            formData.append('selling_price', data.selling_price)
            if (data.notes) formData.append('notes', data.notes)
            if (imageFile) formData.append('image', imageFile)

            await createDamage.mutateAsync(formData)
            toast.success('Damage recorded')
            setDialogOpen(false)
          } catch (err) {
            const msg =
              (err as { response?: { data?: unknown } })?.response?.data
            toast.error(msg ? JSON.stringify(msg) : 'Failed to save')
          }
        }}
        loading={createDamage.isPending}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dialog with image upload
// ---------------------------------------------------------------------------

function DamageDialog({
  open,
  onClose,
  outlets,
  products,
  onSubmit,
  loading,
}: {
  open: boolean
  onClose: () => void
  outlets: { id: number; name: string }[]
  products: { id: number; sku: string; name: string }[]
  onSubmit: (data: DamageForm, imageFile: File | null) => void | Promise<void>
  loading: boolean
}) {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const {
    handleSubmit,
    control,
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<DamageForm>({
    resolver: zodResolver(damageSchema),
    defaultValues: {
      wholesale: outlets[0]?.id ?? 0,
      product: 0,
      quantity: 0,
      selling_price: '',
      notes: '',
    },
  })

  const quantity = watch('quantity')
  const sellingPrice = watch('selling_price')

  const computedLoss = useMemo(() => {
    const q = Number(quantity) || 0
    const p = Number(sellingPrice) || 0
    return q * p
  }, [quantity, sellingPrice])

  const handleFile = (file: File | null) => {
    if (!file) {
      setImageFile(null)
      setImagePreview(null)
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB')
      return
    }
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleClose = () => {
    reset()
    setImageFile(null)
    setImagePreview(null)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Record Damage"
      description="Log damaged or lost stock with optional photo evidence."
    >
      <form
        onSubmit={handleSubmit((data) => onSubmit(data, imageFile))}
        className="space-y-4"
      >
        <Controller
          name="wholesale"
          control={control}
          render={({ field }) => (
            <FormCombobox
              label="Outlet"
              required
              options={outlets.map((o) => ({ value: o.id, label: o.name }))}
              value={field.value || null}
              onChange={(v) => field.onChange(Number(v) || 0)}
              error={errors.wholesale}
            />
          )}
        />

        <Controller
          name="product"
          control={control}
          render={({ field }) => (
            <FormCombobox
              label="Product"
              required
              options={products.map((p) => ({
                value: p.id,
                label: `${p.sku} — ${p.name}`,
              }))}
              value={field.value || null}
              onChange={(v) => field.onChange(Number(v) || 0)}
              error={errors.product}
            />
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Quantity"
            required
            type="number"
            min={1}
            error={errors.quantity}
            {...register('quantity', { valueAsNumber: true })}
          />
          <Controller
            name="selling_price"
            control={control}
            render={({ field }) => (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Selling Price <span className="text-red-500">*</span>
                </label>
                <CurrencyInput
                  value={field.value}
                  onChange={field.onChange}
                  error={Boolean(errors.selling_price)}
                />
                {errors.selling_price && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.selling_price.message}
                  </p>
                )}
              </div>
            )}
          />
        </div>

        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm">
          <span className="text-red-600">Loss value: </span>
          <span className="font-semibold text-red-700">
            {formatK(computedLoss)}
          </span>
        </div>

        {/* Image uploader */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Photo evidence (optional)
          </label>
          {imagePreview ? (
            <div className="relative inline-block">
              <img
                src={imagePreview}
                alt="preview"
                className="h-32 w-32 rounded-md border border-slate-200 object-cover"
              />
              <button
                type="button"
                onClick={() => handleFile(null)}
                className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow hover:bg-red-600"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-slate-300 text-slate-500 transition hover:border-brand-400 hover:bg-slate-50"
            >
              <ImageIcon className="h-6 w-6" />
              <span className="text-xs">Click to upload image (max 5 MB)</span>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <FormField
          label="Notes"
          placeholder="Optional description…"
          error={errors.notes}
          {...register('notes')}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Record Damage'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}