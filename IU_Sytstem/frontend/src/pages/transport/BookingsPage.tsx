import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MRT_ColumnDef } from 'material-react-table'
import { Plus } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { FormField } from '@/components/forms/FormField'
import { FormSelect } from '@/components/forms/FormSelect'
import { DataTable } from '@/components/shared/DataTable'
import { FilterBar } from '@/components/shared/FilterBar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { WriteOnly } from '@/components/guards/WriteOnly'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

import { useBookings, useCreateBooking } from '@/hooks/queries/useTransport'
import { formatDate, formatK } from '@/lib/format'
import type {
  TransportBooking,
  BookingFormData,
  BookingStatus,
  CargoCategory,
} from '@/types/transport'

const bookingSchema = z.object({
  customer_name: z.string().min(1, 'Name required').max(150),
  customer_phone: z.string().min(1, 'Phone required').max(20),
  customer_email: z.string().email().optional().or(z.literal('')),
  pickup_location: z.string().min(1, 'Pickup required').max(200),
  delivery_location: z.string().min(1, 'Delivery required').max(200),
  cargo_description: z.string().min(1, 'Description required'),
  cargo_weight_kg: z.string().min(1, 'Weight required'),
  cargo_category: z.enum(['general', 'dg', 'bulk']),
  pickup_date: z.string().min(1, 'Pickup date required'),
  delivery_date: z.string().optional().nullable(),
  quoted_price: z.string().optional().nullable(),
  notes: z.string().optional(),
})

type BookingForm = z.infer<typeof bookingSchema>

const STATUS_OPTIONS: { value: BookingStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
]

const CARGO_OPTIONS: { value: CargoCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'dg', label: 'Dangerous Goods' },
  { value: 'bulk', label: 'Bulk' },
]

export function BookingsPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: bookings = [], isLoading } = useBookings(
    statusFilter ? { status: statusFilter } : undefined,
  )

  const createBooking = useCreateBooking()

  const filtered = useMemo(() => {
    if (!search) return bookings
    const q = search.toLowerCase()
    return bookings.filter(
      (b) =>
        b.customer_name.toLowerCase().includes(q) ||
        b.customer_phone.includes(q) ||
        b.delivery_location.toLowerCase().includes(q) ||
        b.pickup_location.toLowerCase().includes(q),
    )
  }, [bookings, search])

  const columns = useMemo<MRT_ColumnDef<TransportBooking>[]>(
    () => [
      { accessorKey: 'id', header: '#', size: 60 },
      {
        accessorKey: 'customer_name',
        header: 'Customer',
        size: 160,
        Cell: ({ row }) => (
          <div>
            <p className="font-medium text-slate-800">
              {row.original.customer_name}
            </p>
            <p className="text-xs text-slate-500">
              {row.original.customer_phone}
            </p>
          </div>
        ),
      },
      {
        id: 'route',
        header: 'Route',
        size: 240,
        enableSorting: false,
        Cell: ({ row }) => (
          <div className="text-sm">
            <p className="text-slate-800">{row.original.pickup_location}</p>
            <p className="text-xs text-slate-500">
              → {row.original.delivery_location}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'cargo_weight_kg',
        header: 'Cargo',
        size: 110,
        Cell: ({ cell }) => {
          const kg = Number(cell.getValue<string>())
          return `${kg.toLocaleString()} kg`
        },
      },
      {
        accessorKey: 'pickup_date',
        header: 'Pickup',
        size: 120,
        Cell: ({ cell }) => formatDate(cell.getValue<string>()),
      },
      {
        accessorKey: 'assigned_vehicle_reg',
        header: 'Vehicle',
        size: 120,
        Cell: ({ cell }) =>
          cell.getValue<string | null>() ? (
            <span className="font-mono text-xs">
              {cell.getValue<string>()}
            </span>
          ) : (
            <span className="text-slate-400">—</span>
          ),
      },
      {
        accessorKey: 'assigned_driver_name',
        header: 'Driver',
        size: 140,
        Cell: ({ cell }) => cell.getValue<string | null>() ?? '—',
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 130,
        Cell: ({ cell }) => <StatusBadge status={cell.getValue<string>()} />,
      },
    ],
    [],
  )

  const handleCreate = async (data: BookingForm) => {
    try {
      const payload: BookingFormData = {
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_email: data.customer_email || '',
        pickup_location: data.pickup_location,
        delivery_location: data.delivery_location,
        cargo_description: data.cargo_description,
        cargo_weight_kg: data.cargo_weight_kg,
        cargo_category: data.cargo_category,
        pickup_date: data.pickup_date,
        delivery_date: data.delivery_date || null,
        quoted_price: data.quoted_price || null,
        notes: data.notes || '',
      }
      await createBooking.mutateAsync(payload)
      toast.success('Booking created')
      setDialogOpen(false)
    } catch (err) {
      const msg = (err as { response?: { data?: unknown } })?.response?.data
      toast.error(msg ? JSON.stringify(msg) : 'Failed to create booking')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <p className="text-sm text-slate-500">
          Customer transport requests. Assign vehicles, drivers, and trailers
          from the dispatch view.
        </p>
        <WriteOnly>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New Booking
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
          className="w-44"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Input
          placeholder="Search customer, phone, or destination…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72"
        />
      </FilterBar>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        onRowClick={(b) => navigate(`/transport/bookings/${b.id}`)}
        emptyTitle="No bookings yet"
        emptyDescription="Click 'New Booking' to record a customer request."
      />

      {dialogOpen && (
        <NewBookingDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSubmit={handleCreate}
          loading={createBooking.isPending}
        />
      )}
    </div>
  )
}

function NewBookingDialog({
  open,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (data: BookingForm) => void | Promise<void>
  loading: boolean
}) {
  const today = new Date().toISOString().slice(0, 10)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      customer_name: '',
      customer_phone: '',
      customer_email: '',
      pickup_location: '',
      delivery_location: '',
      cargo_description: '',
      cargo_weight_kg: '',
      cargo_category: 'general',
      pickup_date: today,
      delivery_date: '',
      quoted_price: '',
      notes: '',
    },
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New Booking"
      description="Record a customer transport request."
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Customer
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Name"
            required
            placeholder="Peter Zulu"
            error={errors.customer_name}
            {...register('customer_name')}
          />
          <FormField
            label="Phone"
            required
            placeholder="0977333444"
            error={errors.customer_phone}
            {...register('customer_phone')}
          />
        </div>
        <FormField
          label="Email"
          type="email"
          placeholder="optional@example.com"
          error={errors.customer_email}
          {...register('customer_email')}
        />

        <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Route
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Pickup Location"
            required
            placeholder="Lusaka Industrial Area"
            error={errors.pickup_location}
            {...register('pickup_location')}
          />
          <FormField
            label="Delivery Location"
            required
            placeholder="Kitwe CBD"
            error={errors.delivery_location}
            {...register('delivery_location')}
          />
        </div>

        <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Cargo
        </h3>
        <FormField
          label="Description"
          required
          placeholder="Building materials — cement, iron sheets"
          error={errors.cargo_description}
          {...register('cargo_description')}
        />
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Weight (kg)"
            required
            type="text"
            inputMode="decimal"
            placeholder="4500"
            error={errors.cargo_weight_kg}
            {...register('cargo_weight_kg', {
              setValueAs: (v) => String(v).replace(/[^\d.]/g, ''),
            })}
          />
          <FormSelect
            label="Category"
            required
            options={CARGO_OPTIONS}
            error={errors.cargo_category}
            {...register('cargo_category')}
          />
        </div>

        <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Schedule & Pricing
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Pickup Date"
            required
            type="date"
            error={errors.pickup_date}
            {...register('pickup_date')}
          />
          <FormField
            label="Delivery Date"
            type="date"
            error={errors.delivery_date}
            {...register('delivery_date')}
          />
        </div>
        <Controller
          name="quoted_price"
          control={control}
          render={({ field }) => (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Quoted Price (optional)
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                  K
                </span>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={field.value ?? ''}
                  onChange={(e) =>
                    field.onChange(e.target.value.replace(/[^\d.]/g, ''))
                  }
                  className="pl-8"
                />
              </div>
            </div>
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
            {loading ? 'Creating…' : 'Create Booking'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}