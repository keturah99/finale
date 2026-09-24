import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Truck,
  XCircle,
  Clock,
  Package,
} from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { CardSkeleton } from '@/components/shared/LoadingSkeleton'

import {
  useTransfer,
  useApproveTransfer,
  useReceiveTransfer,
  useCancelTransfer,
} from '@/hooks/queries/useWholesale'
import { formatK, formatDateTime } from '@/lib/format'

export function TransferDetailPage() {
  const { id } = useParams<{ id: string }>()
  const transferId = Number(id)
  const navigate = useNavigate()

  const { data: transfer, isLoading } = useTransfer(transferId)
  const approve = useApproveTransfer()
  const receive = useReceiveTransfer()
  const cancel = useCancelTransfer()

  const [confirmCancel, setConfirmCancel] = useState(false)

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Transfer" />
        <CardSkeleton />
      </div>
    )
  }

  if (!transfer) {
    return (
      <div>
        <PageHeader title="Transfer not found" />
        <Button variant="outline" onClick={() => navigate('/wholesale/transfers')}>
          <ArrowLeft className="h-4 w-4" />
          Back to transfers
        </Button>
      </div>
    )
  }

  const canApprove = transfer.status === 'pending'
  const canReceive = transfer.status === 'in_transit'
  const canCancel = transfer.status === 'pending' || transfer.status === 'in_transit'

  const handleApprove = async () => {
    try {
      await approve.mutateAsync(transferId)
      toast.success('Transfer approved — source stock decremented')
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg ?? 'Approval failed')
    }
  }

  const handleReceive = async () => {
    try {
      await receive.mutateAsync(transferId)
      toast.success('Transfer received — destination stock incremented')
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg ?? 'Receipt failed')
    }
  }

  const handleCancel = async () => {
    try {
      await cancel.mutateAsync(transferId)
      toast.success('Transfer cancelled')
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg ?? 'Cancellation failed')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate('/wholesale/transfers')}
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to transfers
        </button>
        <PageHeader
          title={`Transfer #${transfer.id}`}
          description={`${transfer.from_name} → ${transfer.to_name}`}
          actions={
            <div className="flex items-center gap-2">
              <StatusBadge status={transfer.status} />
              {canApprove && (
                <Button onClick={handleApprove} disabled={approve.isPending}>
                  <Truck className="h-4 w-4" />
                  {approve.isPending ? 'Approving…' : 'Approve'}
                </Button>
              )}
              {canReceive && (
                <Button
                  variant="success"
                  onClick={handleReceive}
                  disabled={receive.isPending}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {receive.isPending ? 'Receiving…' : 'Receive'}
                </Button>
              )}
              {canCancel && (
                <Button
                  variant="destructive"
                  onClick={() => setConfirmCancel(true)}
                  disabled={cancel.isPending}
                >
                  <XCircle className="h-4 w-4" />
                  Cancel
                </Button>
              )}
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: transfer details */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Transfer Details
            </h2>

            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoRow label="From" value={transfer.from_name} />
              <InfoRow label="To" value={transfer.to_name} />
              <InfoRow label="Product" value={transfer.product_name} />
              <InfoRow
                label="Quantity"
                value={`${transfer.quantity.toLocaleString()} units`}
              />
              <InfoRow label="Unit value" value={formatK(transfer.unit_value)} />
              <InfoRow
                label="Total value"
                value={formatK(transfer.total_value)}
                bold
              />
              <InfoRow label="Reference" value={transfer.reference || '—'} />
              <InfoRow label="Notes" value={transfer.notes || '—'} />
            </dl>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Lifecycle
            </h2>
            <Timeline transfer={transfer} />
          </div>
        </div>

        {/* Right: summary card */}
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-slate-500">
              <Package className="h-4 w-4" />
              <p className="text-xs uppercase tracking-wide">Stock Effect</p>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Source decremented</span>
                <span className="font-medium text-slate-800">
                  {transfer.status === 'in_transit' || transfer.status === 'received'
                    ? `${transfer.quantity} units`
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Destination incremented</span>
                <span className="font-medium text-slate-800">
                  {transfer.status === 'received'
                    ? `${transfer.quantity} units`
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={handleCancel}
        title="Cancel this transfer?"
        description={
          transfer.status === 'in_transit'
            ? 'The source stock will be restored.'
            : 'The transfer will be voided. No stock has moved yet.'
        }
        confirmLabel="Cancel Transfer"
        variant="destructive"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small components
// ---------------------------------------------------------------------------

function InfoRow({
  label,
  value,
  bold,
}: {
  label: string
  value: string
  bold?: boolean
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={bold ? 'mt-1 text-base font-semibold text-slate-800' : 'mt-1 text-sm text-slate-800'}>
        {value}
      </dd>
    </div>
  )
}

function Timeline({ transfer }: { transfer: import('@/types/wholesale').Transfer }) {
  const steps = [
    {
      key: 'initiated',
      label: 'Initiated',
      by: transfer.initiated_by_name,
      at: transfer.initiated_at,
      done: true,
      icon: Clock,
    },
    {
      key: 'approved',
      label: 'Approved (in transit)',
      by: transfer.approved_by_name,
      at: transfer.approved_at,
      done: Boolean(transfer.approved_at),
      icon: Truck,
    },
    {
      key: 'received',
      label: 'Received',
      by: transfer.received_by_name,
      at: transfer.received_at,
      done: Boolean(transfer.received_at),
      icon: CheckCircle2,
    },
  ]

  const cancelled = Boolean(transfer.cancelled_at)

  return (
    <ol className="space-y-4">
      {steps.map((step) => {
        const Icon = step.icon
        return (
          <li key={step.key} className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full ${
                step.done
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800">{step.label}</p>
              {step.done && step.at ? (
                <p className="text-xs text-slate-500">
                  {step.by ?? 'system'} · {formatDateTime(step.at)}
                </p>
              ) : (
                <p className="text-xs text-slate-400">Pending</p>
              )}
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
            <p className="text-xs text-slate-500">
              {transfer.cancelled_by_name ?? 'system'} ·{' '}
              {formatDateTime(transfer.cancelled_at)}
            </p>
          </div>
        </li>
      )}
    </ol>
  )
}