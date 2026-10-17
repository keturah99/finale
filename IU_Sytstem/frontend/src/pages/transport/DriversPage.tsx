import { useMemo, useState } from 'react'
import type { MRT_ColumnDef } from 'material-react-table'
import { Plus, Pencil, Trash2, ShieldCheck, ShieldOff } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { FormField } from '@/components/forms/FormField'
import { FormSelect } from '@/components/forms/FormSelect'
import { FormCombobox } from '@/components/forms/FormCombobox'
import { DataTable } from '@/components/shared/DataTable'
import { FilterBar } from '@/components/shared/FilterBar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { WriteOnly } from '@/components/guards/WriteOnly'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownItem,
  DropdownSeparator,
} from '@/components/ui/dropdown-menu'

import {
  useDrivers,
  useCreateDriver,
  useUpdateDriver,
  useDeleteDriver,
  useLicenseClasses,
} from '@/hooks/queries/useTransport'
import { useUsers } from '@/hooks/queries/useCore'
import { useIsReadOnly } from '@/hooks/useIsReadOnly'
import { formatDate } from '@/lib/format'
import type { Driver, DriverFormData, DriverStatus } from '@/types/transport'
import { cn } from '@/lib/utils'

const driverSchema = z.object({
  user: z.number().int().positive('Select a user'),
  license_number: z.string().min(1, 'License number required').max(50),
  license_expiry: z.string().min(1, 'Expiry date required'),
  license_classes: z.array(z.string()).min(1, 'Select at least one class'),
  has_psv: z.boolean(),
  status: z.enum(['available', 'on_trip', 'off_duty', 'suspended']),
})

type DriverForm = z.infer<typeof driverSchema>

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'on_trip', label: 'On Trip' },
  { value: 'off_duty', label: 'Off Duty' },
  { value: 'suspended', label: 'Suspended' },
]

export function DriversPage() {
  const isReadOnly = useIsReadOnly()

  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Driver | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Driver | null>(null)

  const { data: drivers = [], isLoading } = useDrivers(
    statusFilter ? { status: statusFilter } : undefined,
  )

  const createDriver = useCreateDriver()
  const updateDriver = useUpdateDriver(editing?.id ?? 0)
  const deleteDriver = useDeleteDriver()

  const filtered = useMemo(() => {
    if (!search) return drivers
    const q = search.toLowerCase()
    return drivers.filter(
      (d) =>
        d.full_name.toLowerCase().includes(q) ||
        d.license_number.toLowerCase().includes(q),
    )
  }, [drivers, search])

  const columns = useMemo<MRT_ColumnDef<Driver>[]>(() => {
    const base: MRT_ColumnDef<Driver>[] = [
      {
        accessorKey: 'full_name',
        header: 'Driver',
        size: 180,
        Cell: ({ row }) => (
          <div>
            <p className="font-medium text-slate-800 dark:text-slate-100">
              {row.original.full_name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">@{row.original.username}</p>
          </div>
        ),
      },
      {
        accessorKey: 'license_number',
        header: 'License',
        size: 140,
        Cell: ({ cell }) => (
          <span className="font-mono text-sm">{cell.getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'license_expiry',
        header: 'Expires',
        size: 130,
        Cell: ({ cell }) => {
          const value = cell.getValue<string>()
          const expired = new Date(value) < new Date()
          return (
            <span className={expired ? 'text-red-600 font-medium' : ''}>
              {formatDate(value)}
            </span>
          )
        },
      },
      {
        accessorKey: 'class_codes',
        header: 'Classes',
        size: 180,
        enableSorting: false,
        Cell: ({ cell }) => {
          const codes = cell.getValue<string[]>() ?? []
          if (codes.length === 0) return <span className="text-slate-400 dark:text-slate-500">—</span>
          return (
            <div className="flex flex-wrap gap-1">
              {codes.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-1.5 py-0.5 text-xs font-mono font-medium text-slate-700 dark:text-slate-300"
                >
                  {c}
                </span>
              ))}
            </div>
          )
        },
      },
      {
        accessorKey: 'has_psv',
        header: 'PSV',
        size: 80,
        Cell: ({ cell }) =>
          cell.getValue<boolean>() ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Yes
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
              <ShieldOff className="h-3.5 w-3.5" />
              No
            </span>
          ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 120,
        Cell: ({ cell }) => <StatusBadge status={cell.getValue<string>()} />,
      },
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

  const handleSave = async (data: DriverForm) => {
    try {
      const payload = data as DriverFormData
      if (editing) {
        await updateDriver.mutateAsync(payload)
        toast.success('Driver updated')
      } else {
        await createDriver.mutateAsync(payload)
        toast.success('Driver created')
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
      await deleteDriver.mutateAsync(confirmDelete.id)
      toast.success('Driver deleted')
    } catch {
      toast.error('Delete failed')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Drivers with license classes and PSV endorsements. Used for dispatch pairing.
        </p>
        <WriteOnly>
          <Button
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            New Driver
          </Button>
        </WriteOnly>
      </div>

      <FilterBar
        active={Boolean(statusFilter || search)}
        onClear={() => {
          setStatusFilter('')
          setSearch('')
        }}
      >
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-48"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Input
          placeholder="Search name or license…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
      </FilterBar>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        emptyTitle="No drivers yet"
        emptyDescription="Click 'New Driver' to register your first driver."
      />

      {dialogOpen && (
        <DriverDialog
          key={editing?.id ?? 'new'}
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false)
            setEditing(null)
          }}
          onSubmit={handleSave}
          initial={editing}
          loading={createDriver.isPending || updateDriver.isPending}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete this driver?"
        description={
          confirmDelete ? `"${confirmDelete.full_name}" will be removed.` : ''
        }
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  )
}

function DriverDialog({
  open,
  onClose,
  onSubmit,
  initial,
  loading,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (data: DriverForm) => void | Promise<void>
  initial: Driver | null
  loading: boolean
}) {
  const { data: users = [] } = useUsers()
  const { data: licenseClasses = [] } = useLicenseClasses()

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DriverForm>({
    resolver: zodResolver(driverSchema),
    defaultValues: {
      user: initial?.user ?? 0,
      license_number: initial?.license_number ?? '',
      license_expiry: initial?.license_expiry ?? '',
      license_classes: initial?.class_codes ?? [],
      has_psv: initial?.has_psv ?? false,
      status: (initial?.status ?? 'available') as DriverStatus,
    },
  })

  const selectedClasses = watch('license_classes')
  const hasPsv = watch('has_psv')

  const toggleClass = (code: string) => {
    const next = selectedClasses.includes(code)
      ? selectedClasses.filter((c) => c !== code)
      : [...selectedClasses, code]
    setValue('license_classes', next, { shouldValidate: true })
  }

  const userOptions = users
    .filter((u) => !initial || u.id === initial.user)
    .map((u) => ({
      value: u.id,
      label:
        [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username,
    }))

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Edit driver' : 'New driver'}
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Controller
          name="user"
          control={control}
          render={({ field }) => (
            <FormCombobox
              label="User Account"
              required
              options={userOptions}
              value={field.value || null}
              onChange={(v) => field.onChange(Number(v) || 0)}
              error={errors.user}
              emptyText="No eligible users"
            />
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="License Number"
            required
            placeholder="DL-123456"
            error={errors.license_number}
            {...register('license_number')}
          />
          <FormField
            label="License Expiry"
            required
            type="date"
            error={errors.license_expiry}
            {...register('license_expiry')}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
            License Classes <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {licenseClasses.map((lc) => {
              const checked = selectedClasses.includes(lc.code)
              return (
                <button
                  key={lc.code}
                  type="button"
                  onClick={() => toggleClass(lc.code)}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-3 py-2 text-left transition',
                    checked
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/20 text-brand-700'
                      : 'border-slate-300 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-400',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded border',
                      checked
                        ? 'border-brand-500 bg-brand-500 text-white'
                        : 'border-slate-300',
                    )}
                  >
                    {checked && (
                      <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 6l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <div className="flex-1">
                    <p className="font-mono text-sm font-semibold">{lc.code}</p>
                    <p className="text-xs opacity-75">{lc.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
          {errors.license_classes && (
            <p className="mt-1 text-xs text-red-600">
              {errors.license_classes.message}
            </p>
          )}
        </div>

        <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hasPsv}
              onChange={(e) => setValue('has_psv', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
            />
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                PSV Endorsement
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Required for public-category vehicles (passenger service).
              </p>
            </div>
          </label>
        </div>

        <FormSelect
          label="Status"
          required
          options={STATUS_OPTIONS}
          error={errors.status}
          {...register('status')}
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