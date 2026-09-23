import { useState, useMemo } from 'react'
import { Package, Pencil, Trash2 } from 'lucide-react'
import type { MRT_ColumnDef } from 'material-react-table'

import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/forms/FormField'
import { FormSelect } from '@/components/forms/FormSelect'
import { FormCombobox } from '@/components/forms/FormCombobox'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { RegNumberInput } from '@/components/shared/RegNumberInput'
import { DateRangePicker } from '@/components/shared/DateRangePicker'
import { SearchInput } from '@/components/shared/SearchInput'
import { DataTable } from '@/components/shared/DataTable'
import { Dialog } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownItem,
  DropdownSeparator,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

interface Vehicle {
  id: number
  registration_number: string
  make: string
  vehicle_type: string
  tonnage: string
  status: string
}

const demoRows: Vehicle[] = [
  { id: 1, registration_number: 'ABJ 1234', make: 'TOYOTA', vehicle_type: 'fuso', tonnage: '10.00', status: 'available' },
  { id: 2, registration_number: 'ABJ 5678', make: 'ISUZU', vehicle_type: 'van', tonnage: '3.00', status: 'on_trip' },
  { id: 3, registration_number: 'ABJ 9012', make: 'HOWO', vehicle_type: 'semi_truck', tonnage: '20.00', status: 'maintenance' },
  { id: 4, registration_number: 'ABJ 3344', make: 'MITSUBISHI', vehicle_type: 'canter', tonnage: '5.50', status: 'available' },
  { id: 5, registration_number: 'ABJ 7788', make: 'HINO', vehicle_type: 'tipper', tonnage: '18.00', status: 'retired' },
]

export function Playground() {
  const [search, setSearch] = useState('')
  const [currency, setCurrency] = useState('1200.50')
  const [reg, setReg] = useState('')
  const [dates, setDates] = useState({ from: '', to: '' })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [combo, setCombo] = useState<string | number | null>(null)

  const columns = useMemo<MRT_ColumnDef<Vehicle>[]>(
    () => [
      { accessorKey: 'registration_number', header: 'Registration', size: 140 },
      { accessorKey: 'make', header: 'Make', size: 140 },
      { accessorKey: 'vehicle_type', header: 'Type', size: 120 },
      { accessorKey: 'tonnage', header: 'Tonnage (t)', size: 100 },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 140,
        Cell: ({ cell }) => <StatusBadge status={cell.getValue<string>()} />,
      },
      {
        id: 'actions',
        header: '',
        size: 80,
        enableSorting: false,
        enableColumnFilter: false,
        Cell: ({ row }) => (
          <DropdownMenu
            trigger={
              <span className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                •••
              </span>
            }
          >
            <DropdownItem
              onClick={() => toast.info(`Edit ${row.original.registration_number}`)}
            >
              <span className="flex items-center gap-2">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </span>
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem
              destructive
              onClick={() => toast.error(`Delete ${row.original.registration_number}`)}
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

  return (
    <div className="space-y-10">
      <PageHeader
        title="Playground"
        description="Visual preview of shared components"
        actions={<Button onClick={() => toast.success('Toast fired')}>Fire toast</Button>}
      />

      {/* Buttons */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Buttons</h2>
        <div className="flex flex-wrap gap-2">
          <Button>Default</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="success">Success</Button>
          <Button variant="link">Link</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      {/* Status badges */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Status badges</h2>
        <div className="flex flex-wrap gap-2">
          {['available', 'on_trip', 'maintenance', 'retired',
            'pending', 'assigned', 'in_transit', 'delivered', 'cancelled',
            'received', 'low', 'out', 'open', 'closed'].map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </div>
      </section>

      {/* Inputs */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Inputs</h2>
        <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Text" placeholder="Type here" />
          <FormField label="With error" placeholder="Type here" error="This field is required" />
          <FormSelect
            label="Select"
            placeholder="Choose…"
            options={[
              { value: 'a', label: 'Option A' },
              { value: 'b', label: 'Option B' },
            ]}
          />
          <FormCombobox
            label="Combobox"
            options={[
              { value: 1, label: 'Wholesale Lusaka' },
              { value: 2, label: 'Wholesale Kitwe' },
              { value: 3, label: 'Wholesale Ndola' },
            ]}
            value={combo}
            onChange={setCombo}
          />
          <CurrencyInput label="Currency" value={currency} onChange={setCurrency} />
          <RegNumberInput label="Registration" value={reg} onChange={setReg} />
        </div>
        <div className="mt-4 max-w-md">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Date range
          </label>
          <DateRangePicker from={dates.from} to={dates.to} onChange={setDates} />
        </div>
        <div className="mt-4">
          <SearchInput value={search} onChange={setSearch} />
          <p className="mt-1 text-xs text-slate-500">
            Debounced value: {search || '—'}
          </p>
        </div>
      </section>

      {/* Data table */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">
          DataTable (Material React Table)
        </h2>
        <DataTable
          columns={columns}
          data={demoRows}
          onRowClick={(row) => toast.info(`Clicked ${row.registration_number}`)}
          emptyTitle="No vehicles yet"
          emptyDescription="Add your first vehicle to see it here."
        />
      </section>

      {/* Empty state */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">EmptyState</h2>
        <div className="rounded-lg border border-slate-200 bg-white">
          <EmptyState
            icon={Package}
            title="No vehicles yet"
            description="Add your first vehicle to get started."
            action={<Button>Add vehicle</Button>}
          />
        </div>
      </section>

      {/* Dialogs */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Dialogs</h2>
        <div className="flex gap-2">
          <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            Confirm delete
          </Button>
        </div>
      </section>

      <Dialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false)
        }}
        title="Example dialog"
        description="This is a modal you can put anything inside."
      >
        <FormField label="Name" placeholder="Jane Doe" />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setDialogOpen(false)
            }}
          >
            Save
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false)
        }}
        onConfirm={() => {
          toast.success('Confirmed')
        }}
        title="Delete this item?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  )
}