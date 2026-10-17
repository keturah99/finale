import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Truck,
  User as UserIcon,
  Container,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Package,
  Clock,
  PlayCircle,
  Flag,
  RotateCcw,
  Star,
  ShieldCheck,
  ShieldOff,
  MapPin,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { CardSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'

import {
  useBooking,
  useEligibleVehicles,
  useEligibleDrivers,
  useTrailers,
  useAssignVehicle,
  useAssignDriver,
  useAttachTrailers,
  useUnassignBooking,
  useUpdateBookingStatus,
} from '@/hooks/queries/useTransport'

import { formatDate, formatDateTime, formatK } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Vehicle, Driver, Trailer } from '@/types/transport'

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function BookingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const bookingId = Number(id)
  const navigate = useNavigate()

  const { data: booking, isLoading } = useBooking(bookingId)
  const updateStatus = useUpdateBookingStatus()
  const unassign = useUnassignBooking()

  const [vehicleDialog, setVehicleDialog] = useState(false)
  const [driverDialog, setDriverDialog] = useState(false)
  const [trailerDialog, setTrailerDialog] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmUnassign, setConfirmUnassign] = useState(false)

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Booking" />
        <CardSkeleton />
      </div>
    )
  }

  if (!booking) {
    return (
      <div>
        <PageHeader title="Booking not found" />
        <Button variant="outline" onClick={() => navigate('/transport/bookings')}>
          <ArrowLeft className="h-4 w-4" />
          Back to bookings
        </Button>
      </div>
    )
  }

  const hasVehicle = Boolean(booking.assigned_vehicle)
  const hasDriver = Boolean(booking.assigned_driver)
  const isTerminal = ['delivered', 'cancelled'].includes(booking.status)
  const canManageTrailers = hasVehicle && !isTerminal

  const handleStatusChange = async (status: string, label: string) => {
    try {
      await updateStatus.mutateAsync({ id: bookingId, body: { status } })
      toast.success(label)
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response
        ?.data?.error
      toast.error(msg ?? 'Failed to update status')
    }
  }

  const handleUnassign = async () => {
    try {
      await unassign.mutateAsync({ id: bookingId })
      toast.success('All resources released')
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response
        ?.data?.error
      toast.error(msg ?? 'Failed to unassign')
    }
  }

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <button
          onClick={() => navigate('/transport/bookings')}
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to bookings
        </button>

        <PageHeader
          title={`Booking #${booking.id} — ${booking.customer_name}`}
          description={`${booking.pickup_location} → ${booking.delivery_location}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={booking.status} />

              {!isTerminal && !hasVehicle && (
                <Button onClick={() => setVehicleDialog(true)}>
                  <Truck className="h-4 w-4" />
                  Assign Vehicle
                </Button>
              )}

              {!isTerminal && hasVehicle && !hasDriver && (
                <Button onClick={() => setDriverDialog(true)}>
                  <UserIcon className="h-4 w-4" />
                  Assign Driver
                </Button>
              )}

              {canManageTrailers && (
                <Button variant="outline" onClick={() => setTrailerDialog(true)}>
                  <Container className="h-4 w-4" />
                  Trailers
                  {booking.assigned_trailers.length > 0 && (
                    <span className="ml-1 rounded-full bg-brand-100 px-1.5 text-xs">
                      {booking.assigned_trailers.length}
                    </span>
                  )}
                </Button>
              )}

              {booking.status === 'assigned' && (
                <Button
                  variant="success"
                  onClick={() => handleStatusChange('in_transit', 'Trip started')}
                  disabled={updateStatus.isPending}
                >
                  <PlayCircle className="h-4 w-4" />
                  Start Trip
                </Button>
              )}

              {booking.status === 'in_transit' && (
                <Button
                  variant="success"
                  onClick={() =>
                    handleStatusChange('delivered', 'Booking delivered')
                  }
                  disabled={updateStatus.isPending}
                >
                  <Flag className="h-4 w-4" />
                  Mark Delivered
                </Button>
              )}

              {!isTerminal && hasVehicle && (
                <Button
                  variant="outline"
                  onClick={() => setConfirmUnassign(true)}
                  disabled={unassign.isPending}
                >
                  <RotateCcw className="h-4 w-4" />
                  Unassign
                </Button>
              )}

              {!isTerminal && (
                <Button
                  variant="destructive"
                  onClick={() => setConfirmCancel(true)}
                  disabled={updateStatus.isPending}
                >
                  <XCircle className="h-4 w-4" />
                  Cancel
                </Button>
              )}
            </div>
          }
        />
      </div>

      {/* Pairing warning */}
      {booking.pairing_warning && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1 text-sm text-amber-800">
            <p className="font-medium">Dispatch notice</p>
            <p className="mt-0.5">{booking.pairing_warning}</p>
          </div>
        </div>
      )}

      {/* Two columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: booking info */}
        <div className="space-y-4 lg:col-span-2">
          <InfoCard title="Customer" icon={UserIcon}>
            <InfoRow label="Name" value={booking.customer_name} />
            <InfoRow label="Phone" value={booking.customer_phone} />
            {booking.customer_email && (
              <InfoRow label="Email" value={booking.customer_email} />
            )}
          </InfoCard>

          <InfoCard title="Route" icon={MapPin}>
            <InfoRow label="Pickup" value={booking.pickup_location} />
            <InfoRow label="Delivery" value={booking.delivery_location} />
            <InfoRow label="Pickup date" value={formatDate(booking.pickup_date)} />
            {booking.delivery_date && (
              <InfoRow
                label="Delivery date"
                value={formatDate(booking.delivery_date)}
              />
            )}
          </InfoCard>

          <InfoCard title="Cargo" icon={Package}>
            <InfoRow label="Description" value={booking.cargo_description} />
            <InfoRow
              label="Weight"
              value={`${Number(booking.cargo_weight_kg).toLocaleString()} kg`}
            />
            <InfoRow
              label="Category"
              value={
                booking.cargo_category === 'dg'
                  ? 'Dangerous Goods'
                  : booking.cargo_category === 'bulk'
                    ? 'Bulk'
                    : 'General'
              }
            />
            {booking.quoted_price && (
              <InfoRow label="Quoted price" value={formatK(booking.quoted_price)} bold />
            )}
            {booking.notes && <InfoRow label="Notes" value={booking.notes} />}
          </InfoCard>

          <InfoCard title="Lifecycle" icon={Clock}>
            <Timeline booking={booking} />
          </InfoCard>
        </div>

        {/* Right: assignment */}
        <div className="space-y-4">
          <AssignmentCard
            title="Vehicle"
            icon={Truck}
            assigned={hasVehicle}
            primaryText={booking.assigned_vehicle_reg}
            secondaryText={null}
            onAssign={!hasVehicle && !isTerminal ? () => setVehicleDialog(true) : undefined}
          />

          <AssignmentCard
            title="Driver"
            icon={UserIcon}
            assigned={hasDriver}
            primaryText={booking.assigned_driver_name}
            secondaryText={null}
            onAssign={
              hasVehicle && !hasDriver && !isTerminal
                ? () => setDriverDialog(true)
                : undefined
            }
          />

          <AssignmentCard
            title="Trailers"
            icon={Container}
            assigned={booking.assigned_trailers.length > 0}
            primaryText={
              booking.assigned_trailer_regs.length > 0
                ? booking.assigned_trailer_regs.join(', ')
                : null
            }
            secondaryText={
              booking.assigned_trailers.length > 0
                ? `${booking.assigned_trailers.length} trailer${
                    booking.assigned_trailers.length > 1 ? 's' : ''
                  }`
                : null
            }
            onAssign={canManageTrailers ? () => setTrailerDialog(true) : undefined}
          />

          {booking.pairing_source === 'primary' && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
              <p className="flex items-center gap-1.5 font-medium">
                <Star className="h-3.5 w-3.5" />
                Primary pairing honored
              </p>
              <p className="mt-0.5">
                Vehicle and driver were auto-paired based on the standing
                arrangement.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {vehicleDialog && (
        <VehicleDialog
          open={vehicleDialog}
          bookingId={bookingId}
          onClose={() => setVehicleDialog(false)}
          onSuccess={(result) => {
            setVehicleDialog(false)
            if (result === 'assigned') {
              toast.success('Vehicle and primary driver assigned')
            } else {
              toast.success('Vehicle assigned')
            }
          }}
        />
      )}

      {driverDialog && (
        <DriverDialog
          open={driverDialog}
          bookingId={bookingId}
          vehicleReg={booking.assigned_vehicle_reg}
          onClose={() => setDriverDialog(false)}
          onSuccess={() => {
            setDriverDialog(false)
            toast.success('Driver assigned')
          }}
        />
      )}

      {trailerDialog && (
        <TrailerDialog
          open={trailerDialog}
          bookingId={bookingId}
          cargoKg={Number(booking.cargo_weight_kg)}
          currentTrailerIds={booking.assigned_trailers}
          vehicleReg={booking.assigned_vehicle_reg}
          onClose={() => setTrailerDialog(false)}
          onSuccess={() => {
            setTrailerDialog(false)
            toast.success('Trailers updated')
          }}
        />
      )}

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => handleStatusChange('cancelled', 'Booking cancelled')}
        title="Cancel this booking?"
        description="All assigned resources will be released."
        confirmLabel="Cancel Booking"
        variant="destructive"
      />

      <ConfirmDialog
        open={confirmUnassign}
        onClose={() => setConfirmUnassign(false)}
        onConfirm={handleUnassign}
        title="Unassign all resources?"
        description="Vehicle, driver, and trailers will be released back to available."
        confirmLabel="Unassign All"
        variant="destructive"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Info card + row
// ---------------------------------------------------------------------------

function InfoCard({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {title}
        </h2>
      </div>
      <dl className="space-y-3">{children}</dl>
    </div>
  )
}

function InfoRow({
  label,
  value,
  bold = false,
}: {
  label: string
  value: string
  bold?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd
        className={cn(
          'text-right text-sm text-slate-800 dark:text-slate-100',
          bold && 'font-semibold',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Assignment card
// ---------------------------------------------------------------------------

function AssignmentCard({
  title,
  icon: Icon,
  assigned,
  primaryText,
  secondaryText,
  onAssign,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  assigned: boolean
  primaryText: string | null
  secondaryText: string | null
  onAssign?: () => void
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        assigned
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900',
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <Icon
          className={cn(
            'h-4 w-4',
            assigned ? 'text-emerald-600' : 'text-slate-400 dark:text-slate-500',
          )}
        />
        <p
          className={cn(
            'text-xs font-semibold uppercase tracking-wide',
            assigned ? 'text-emerald-700' : 'text-slate-500 dark:text-slate-400',
          )}
        >
          {title}
        </p>
      </div>

      {assigned && primaryText ? (
        <div>
          <p className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">
            {primaryText}
          </p>
          {secondaryText && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{secondaryText}</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-400 dark:text-slate-500">Not assigned</p>
      )}

      {onAssign && (
        <button
          onClick={onAssign}
          className="mt-3 text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          {assigned ? 'Change' : '+ Assign'}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

function Timeline({ booking }: { booking: import('@/types/transport').TransportBooking }) {
  const cancelled = booking.status === 'cancelled'
  const assigned = ['assigned', 'in_transit', 'delivered'].includes(booking.status)
  const inTransit = ['in_transit', 'delivered'].includes(booking.status)
  const delivered = booking.status === 'delivered'

  const steps = [
    {
      key: 'booked',
      label: 'Booked',
      sub: formatDateTime(booking.created_at),
      done: true,
      icon: Clock,
      cancelled: false,
    },
    {
      key: 'assigned',
      label: 'Assigned',
      sub: assigned
        ? booking.assigned_at
          ? formatDateTime(booking.assigned_at)
          : 'Assigned'
        : 'Pending',
      done: assigned,
      icon: Truck,
      cancelled: false,
    },
    {
      key: 'in_transit',
      label: 'In Transit',
      sub: inTransit ? 'Trip started' : 'Pending',
      done: inTransit,
      icon: PlayCircle,
      cancelled: false,
    },
    {
      key: 'delivered',
      label: 'Delivered',
      sub: delivered ? 'Completed' : 'Pending',
      done: delivered,
      icon: CheckCircle2,
      cancelled: false,
    },
  ]

  return (
    <ol className="space-y-4">
      {steps.map((step) => {
        const Icon = step.icon
        return (
          <li key={step.key} className="flex items-start gap-3">
            <div
              className={cn(
                'mt-0.5 flex h-8 w-8 items-center justify-center rounded-full',
                step.done
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500',
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{step.label}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{step.sub}</p>
            </div>
          </li>
        )
      })}

      {cancelled && (
        <li className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600">
            <XCircle className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-700">Cancelled</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {formatDateTime(booking.updated_at)}
            </p>
          </div>
        </li>
      )}
    </ol>
  )
}

// ---------------------------------------------------------------------------
// Vehicle dialog
// ---------------------------------------------------------------------------

function VehicleDialog({
  open,
  bookingId,
  onClose,
  onSuccess,
}: {
  open: boolean
  bookingId: number
  onClose: () => void
  onSuccess: (result: 'assigned' | 'vehicle-only') => void
}) {
  const { data: vehicles = [], isLoading } = useEligibleVehicles(bookingId)
  const assign = useAssignVehicle()
  const [selected, setSelected] = useState<number | null>(null)

  const handleSubmit = async () => {
    if (!selected) return
    try {
      const result = await assign.mutateAsync({
        id: bookingId,
        body: { vehicle_id: selected },
      })
      const wasAssigned = result.status === 'assigned'
      onSuccess(wasAssigned ? 'assigned' : 'vehicle-only')
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response
        ?.data?.error
      toast.error(msg ?? 'Failed to assign vehicle')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Assign Vehicle"
      description="Only vehicles with sufficient tonnage for this cargo are shown."
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>}

        {!isLoading && vehicles.length === 0 && (
          <EmptyState
            title="No eligible vehicles"
            description="All vehicles with sufficient capacity are on trips or under maintenance."
          />
        )}

        {vehicles.length > 0 && (
          <div className="max-h-96 space-y-2 overflow-auto">
            {vehicles.map((v) => {
              const isSelected = selected === v.id
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelected(v.id)}
                  className={cn(
                    'w-full rounded-md border px-4 py-3 text-left transition',
                    isSelected
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-400',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {v.registration_number}
                      </span>
                      {v.primary_driver_name && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          <Star className="h-3 w-3" />
                          {v.primary_driver_name}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {v.vehicle_type_display}
                    </span>
                  </div>
                  <div className="mt-1 flex gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>{v.tonnage} t</span>
                    <span className="capitalize">{v.category}</span>
                    <span className="capitalize">{v.make}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selected || assign.isPending}
            onClick={handleSubmit}
          >
            {assign.isPending ? 'Assigning…' : 'Assign Vehicle'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Driver dialog
// ---------------------------------------------------------------------------

function DriverDialog({
  open,
  bookingId,
  vehicleReg,
  onClose,
  onSuccess,
}: {
  open: boolean
  bookingId: number
  vehicleReg: string | null
  onClose: () => void
  onSuccess: () => void
}) {
  const { data: drivers = [], isLoading } = useEligibleDrivers(bookingId)
  const assign = useAssignDriver()
  const [selected, setSelected] = useState<number | null>(null)

  const handleSubmit = async () => {
    if (!selected) return
    try {
      await assign.mutateAsync({ id: bookingId, body: { driver_id: selected } })
      onSuccess()
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response
        ?.data?.error
      toast.error(msg ?? 'Failed to assign driver')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Assign Driver"
      description={
        vehicleReg
          ? `Only drivers qualified for ${vehicleReg} are shown.`
          : 'Only eligible drivers are shown.'
      }
      className="max-w-xl"
    >
      <div className="space-y-4">
        {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>}

        {!isLoading && drivers.length === 0 && (
          <EmptyState
            title="No eligible drivers"
            description="All matching drivers are on trips or don't have the required license class."
          />
        )}

        {drivers.length > 0 && (
          <div className="max-h-96 space-y-2 overflow-auto">
            {drivers.map((d) => {
              const isSelected = selected === d.id
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelected(d.id)}
                  className={cn(
                    'w-full rounded-md border px-4 py-3 text-left transition',
                    isSelected
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-400',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {d.full_name}
                    </p>
                    {d.has_psv ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        PSV
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                        <ShieldOff className="h-3.5 w-3.5" />
                        No PSV
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {d.license_number}
                    </span>
                    <span className="text-slate-300">·</span>
                    <div className="flex gap-1">
                      {d.class_codes.map((c) => (
                        <span
                          key={c}
                          className="inline-flex rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-1.5 py-0.5 font-mono text-xs font-medium text-slate-700 dark:text-slate-300"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selected || assign.isPending}
            onClick={handleSubmit}
          >
            {assign.isPending ? 'Assigning…' : 'Assign Driver'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Trailer dialog
// ---------------------------------------------------------------------------

function TrailerDialog({
  open,
  bookingId,
  cargoKg,
  currentTrailerIds,
  vehicleReg,
  onClose,
  onSuccess,
}: {
  open: boolean
  bookingId: number
  cargoKg: number
  currentTrailerIds: number[]
  vehicleReg: string | null
  onClose: () => void
  onSuccess: () => void
}) {
  const { data: trailers = [], isLoading } = useTrailers({ status: 'available' })
  const attach = useAttachTrailers()
  const [selected, setSelected] = useState<number[]>(currentTrailerIds)

  const toggle = (id: number) => {
    if (selected.includes(id)) {
      setSelected(selected.filter((x) => x !== id))
    } else {
      if (selected.length >= 2) {
        toast.error('Maximum 2 trailers per booking')
        return
      }
      setSelected([...selected, id])
    }
  }

  const selectedTrailers: Trailer[] = useMemo(
    () => trailers.filter((t) => selected.includes(t.id)),
    [trailers, selected],
  )

  // Trailer tonnage is the trailer's own capacity; combined with the semi
  // this gives a ballpark. We don't fetch the semi here, so we show the
  // sum of selected trailer tonnages as the "added capacity".
  const trailerCapacity = useMemo(() => {
    return selectedTrailers.reduce((sum, t) => sum + Number(t.tonnage || 0), 0)
  }, [selectedTrailers])

  const cargoT = cargoKg / 1000
  const trailerCount = selected.length

  const handleSubmit = async () => {
    try {
      await attach.mutateAsync({
        id: bookingId,
        body: { trailer_ids: selected },
      })
      onSuccess()
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response
        ?.data?.error
      toast.error(msg ?? 'Failed to update trailers')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Attach Trailers"
      description={
        vehicleReg
          ? `Select up to 2 trailers for ${vehicleReg}.`
          : 'Select up to 2 trailers.'
      }
      className="max-w-xl"
    >
      <div className="space-y-4">
        {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>}

        {!isLoading && trailers.length === 0 && (
          <EmptyState
            title="No available trailers"
            description="All trailers are on trips or under maintenance."
          />
        )}

        {trailers.length > 0 && (
          <div className="max-h-72 space-y-2 overflow-auto">
            {trailers.map((t) => {
              const isSelected = selected.includes(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggle(t.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left transition',
                    isSelected
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-400',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                      isSelected
                        ? 'border-brand-500 bg-brand-500 text-white'
                        : 'border-slate-300',
                    )}
                  >
                    {isSelected && (
                      <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 6l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {t.registration_number}
                      </span>
                      <span className="text-sm text-slate-600 dark:text-slate-300">
                        {t.tonnage} t
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {t.make} · {t.category}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Capacity summary */}
        <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Selected trailers</span>
            <span className="font-medium text-slate-800 dark:text-slate-100">{trailerCount} / 2</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Trailer capacity</span>
            <span className="font-medium text-slate-800 dark:text-slate-100">
              {trailerCapacity.toFixed(2)} t
            </span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Cargo weight</span>
            <span className="font-medium text-slate-800 dark:text-slate-100">
              {cargoT.toFixed(2)} t
            </span>
          </div>
          {trailerCount === 0 && (
            <p className="mt-2 text-xs text-amber-600">
              ⚠ No trailer selected. The backend will reject if cargo exceeds
              the vehicle's solo capacity.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={attach.isPending} onClick={handleSubmit}>
            {attach.isPending ? 'Saving…' : 'Save Trailers'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}