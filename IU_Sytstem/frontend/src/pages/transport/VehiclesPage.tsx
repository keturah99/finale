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
import { FormCombobox } from '@/components/forms/FormCombobox'
import { RegNumberInput } from '@/components/shared/RegNumberInput'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { DataTable } from '@/components/shared/DataTable'
import { FilterBar } from '@/components/shared/FilterBar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownItem,
  DropdownSeparator,
} from '@/components/ui/dropdown-menu'

import {
  useVehicles,
  useCreateVehicle,
  useUpdateVehicle,
  useDeleteVehicle,
  useDrivers,
} from '@/hooks/queries/useTransport'
import type {
  Vehicle,
  VehicleFormData,
  VehicleType,
  VehicleCategory,
  VehicleStatus,
} from '@/types/transport'

// ---------------------------------------------------------------------------
// Form schema
// ---------------------------------------------------------------------------

const vehicleSchema = z.object({
  registration_number: z
    .string()
    .regex(/^[A-Z]{3} \d{4}$/, 'Format: ABC 1234'),
  make: z.string().min(1, 'Make required').max(50),
  vehicle_type: z.enum([
    'small_car', 'van', 'canter', 'fuso', 'tipper', 'semi_truck',
  ]),
  tonnage: z.string().min(1, 'Tonnage required'),
  category: z.enum(['public', 'private']),
  status: z.enum(['available', 'on_trip', 'maintenance', 'retired']),
  primary_driver: z.number().int().nullable().optional(),
  notes: z.string().optional(),
})

type VehicleForm = z.infer<typeof vehicleSchema>

const TYPE_OPTIONS = [
  { value: 'small_car', label: 'Small Car' },
  { value: 'van', label: 'Van' },
  { value: 'canter', label: 'Canter' },
  { value: 'fuso', label: 'Fuso' },
  { value: 'tipper', label: 'Tipper' },
  { value: 'semi_truck', label: 'Semi Truck' },
]

const CATEGORY_OPTIONS = [
  { value: 'private', label: 'Private' },
  { value: 'public', label: 'Public' },
]

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'on_trip', label: 'On Trip' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retired' },
]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function VehiclesPage() {
  const [typeFilter, setTypeFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Vehicle | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Vehicle | null>(null)

  const { data: vehicles = [], isLoading } = useVehicles({
    ...(typeFilter ? { vehicle_type: typeFilter } : {}),
    ...(categoryFilter ? { category: categoryFilter } : {}),
  })

  const createVehicle = useCreateVehicle()
  const updateVehicle = useUpdateVehicle(editing?.id ?? 0)
  const deleteVehicle = useDeleteVehicle()

  const filtered = useMemo(() => {
    if (!search) return vehicles
    const q = search.toLowerCase()
    return vehicles.filter(
      (v) =>
        v.registration_number.toLowerCase().includes(q) ||
        v.make.toLowerCase().includes(q),
    )
  }, [vehicles, search])

  const columns = useMemo<MRT_ColumnDef<Vehicle>[]>(
    () => [
      {
        accessorKey: 'registration_number',
        header: 'Registration',
        size: 140,
        Cell: ({ cell }) => (
          <span className="font-mono font-semibold text-slate-800">
            {cell.getValue<string>()}
          </span>
        ),
      },
      { accessorKey: 'make', header: 'Make', size: 140 },
      {
        accessorKey: 'vehicle_type_display',
        header: 'Type',
        size: 130,
      },
      {
        accessorKey: 'tonnage',
        header: 'Tonnage',
        size: 100,
        Cell: ({ cell }) => `${cell.getValue<string>()} t`,
      },
      {
        accessorKey: 'category_display',
        header: 'Category',
        size: 110,
        Cell: ({ cell }) => (
          <StatusBadge status={cell.row.original.category} />
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 120,
        Cell: ({ cell }) => <StatusBadge status={cell.getValue<string>()} />,
      },
      {
        accessorKey: 'primary_driver_name',
        header: 'Primary Driver',
        size: 180,
        Cell: ({ cell }) => cell.getValue<string | null>() ?? '—',
      },
      {
        id: 'actions',
        header: '',
        size: 60,
        enableSorting: false,
        enableColumnFilter: false,
        Cell: ({ row }) => (
          <DropdownMenu
            trigger={
              <span className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
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
      },
    ],
    [],
  )

  const handleSave = async (data: VehicleForm) => {
    try {
      const payload: VehicleFormData = {
        registration_number: data.registration_number,
        make: data.make,
        vehicle_type: data.vehicle_type as VehicleType,
        tonnage: data.tonnage,
        category: data.category as VehicleCategory,
        status: data.status as VehicleStatus,
        primary_driver: data.primary_driver ?? null,
        notes: data.notes ?? '',
      }

      if (editing) {
        await updateVehicle.mutateAsync(payload)
        toast.success('Vehicle updated')
      } else {
        await createVehicle.mutateAsync(payload)
        toast.success('Vehicle created')
      }
      setDialogOpen(false)
      setEditing(null)
    } catch (err) {
      const msg = (err as { response?: { data?: unknown } })?.response?.data
      toast.error(msg ? JSON.stringify(msg) : 'Save failed')
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      await deleteVehicle.mutateAsync(confirmDelete.id)
      toast.success('Vehicle deleted')
    } catch {
      toast.error('Delete failed')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <p className="text-sm text-slate-500">
          Company fleet. Each vehicle can have a primary driver for auto-pairing.
        </p>
        <Button
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="h-4 w-4" />
          New Vehicle
        </Button>
      </div>

      <FilterBar
        active={Boolean(typeFilter || categoryFilter || search)}
        onClear={() => {
          setTypeFilter('')
          setCategoryFilter('')
          setSearch('')
        }}
      >
        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-48"
        >
          <option value="">All types</option>
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-40"
        >
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Input
          placeholder="Search registration or make…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
      </FilterBar>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        emptyTitle="No vehicles yet"
        emptyDescription="Click 'New Vehicle' to add your first vehicle."
      />

      {dialogOpen && (
        <VehicleDialog
          key={editing?.id ?? 'new'}
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false)
            setEditing(null)
          }}
          onSubmit={handleSave}
          initial={editing}
          loading={createVehicle.isPending || updateVehicle.isPending}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete this vehicle?"
        description={
          confirmDelete
            ? `"${confirmDelete.registration_number}" will be removed.`
            : ''
        }
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

function VehicleDialog({
  open,
  onClose,
  onSubmit,
  initial,
  loading,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (data: VehicleForm) => void | Promise<void>
  initial: Vehicle | null
  loading: boolean
}) {
  const { data: drivers = [] } = useDrivers()

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<VehicleForm>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      registration_number: initial?.registration_number ?? '',
      make: initial?.make ?? '',
      vehicle_type: (initial?.vehicle_type ?? 'fuso') as VehicleType,
      tonnage: initial?.tonnage ?? '',
      category: (initial?.category ?? 'private') as VehicleCategory,
      status: (initial?.status ?? 'available') as VehicleStatus,
      primary_driver: initial?.primary_driver ?? null,
      notes: initial?.notes ?? '',
    },
  })

  const driverOptions = drivers.map((d) => ({
    value: d.id,
    label: `${d.full_name} (${d.license_number})`,
  }))

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Edit vehicle' : 'New vehicle'}
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Controller
            name="registration_number"
            control={control}
            render={({ field }) => (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Registration <span className="text-red-500">*</span>
                </label>
                <RegNumberInput
                  value={field.value}
                  onChange={field.onChange}
                />
                {errors.registration_number && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.registration_number.message}
                  </p>
                )}
              </div>
            )}
          />

          <FormField
            label="Make"
            required
            placeholder="TOYOTA"
            error={errors.make}
            {...register('make')}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormSelect
            label="Type"
            required
            options={TYPE_OPTIONS}
            error={errors.vehicle_type}
            {...register('vehicle_type')}
          />
          <Controller
            name="tonnage"
            control={control}
            render={({ field }) => (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Tonnage <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="10.00"
                  value={field.value}
                  onChange={(e) =>
                    field.onChange(e.target.value.replace(/[^\d.]/g, ''))
                  }
                  error={Boolean(errors.tonnage)}
                />
                {errors.tonnage && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.tonnage.message}
                  </p>
                )}
              </div>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormSelect
            label="Category"
            required
            options={CATEGORY_OPTIONS}
            error={errors.category}
            {...register('category')}
          />
          <FormSelect
            label="Status"
            required
            options={STATUS_OPTIONS}
            error={errors.status}
            {...register('status')}
          />
        </div>

        <Controller
          name="primary_driver"
          control={control}
          render={({ field }) => (
            <FormCombobox
              label="Primary Driver"
              options={driverOptions}
              value={field.value ?? null}
              onChange={(v) => field.onChange(v === null ? null : Number(v))}
              placeholder="Not assigned"
              emptyText="No drivers registered"
            />
          )}
        />

        <FormField
          label="Notes"
          placeholder="Optional notes…"
          error={errors.notes}
          {...register('notes')}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving…' : initial ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}