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
import { FormCombobox } from '@/components/forms/FormCombobox'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { DataTable } from '@/components/shared/DataTable'
import { FilterBar } from '@/components/shared/FilterBar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { WriteOnly } from '@/components/guards/WriteOnly'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownItem, DropdownSeparator,
} from '@/components/ui/dropdown-menu'

import {
  useSalaries, useCreateSalary, useUpdateSalary, useDeleteSalary,
} from '@/hooks/queries/usePayroll'
import { useUsers } from '@/hooks/queries/useCore'
import { useIsReadOnly } from '@/hooks/useIsReadOnly'
import { formatK, formatDate } from '@/lib/format'
import type { SalaryStructure, SalaryStructureFormData } from '@/types/payroll'

const schema = z.object({
  employee: z.number().int().positive('Select an employee'),
  basic_salary: z.string().min(1, 'Basic salary required'),
  housing_allowance: z.string().optional(),
  transport_allowance: z.string().optional(),
  other_allowances: z.string().optional(),
  effective_from: z.string().min(1, 'Effective date required'),
  effective_to: z.string().optional(),
  is_active: z.boolean(),
})

type Form = z.infer<typeof schema>

export function SalariesPage() {
  const isReadOnly = useIsReadOnly()

  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<SalaryStructure | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<SalaryStructure | null>(null)

  const { data: salaries = [], isLoading } = useSalaries()
  const { data: users = [] } = useUsers()
  const createSalary = useCreateSalary()
  const updateSalary = useUpdateSalary(editing?.id ?? 0)
  const deleteSalary = useDeleteSalary()

  const filtered = useMemo(() => {
    if (!search) return salaries
    const q = search.toLowerCase()
    return salaries.filter((s) => s.employee_name.toLowerCase().includes(q))
  }, [salaries, search])

  const columns = useMemo<MRT_ColumnDef<SalaryStructure>[]>(() => {
    const base: MRT_ColumnDef<SalaryStructure>[] = [
      { accessorKey: 'employee_name', header: 'Employee', size: 180 },
      { accessorKey: 'basic_salary', header: 'Basic', size: 120,
        Cell: ({ cell }) => formatK(cell.getValue<string>()) },
      { accessorKey: 'housing_allowance', header: 'Housing', size: 110,
        Cell: ({ cell }) => formatK(cell.getValue<string>()) },
      { accessorKey: 'transport_allowance', header: 'Transport', size: 110,
        Cell: ({ cell }) => formatK(cell.getValue<string>()) },
      { accessorKey: 'other_allowances', header: 'Other', size: 100,
        Cell: ({ cell }) => formatK(cell.getValue<string>()) },
      { accessorKey: 'gross_monthly', header: 'Gross', size: 130,
        Cell: ({ cell }) => (
          <span className="font-semibold">{formatK(cell.getValue<string>())}</span>
        ) },
      { accessorKey: 'effective_from', header: 'From', size: 110,
        Cell: ({ cell }) => formatDate(cell.getValue<string>()) },
      { accessorKey: 'is_active', header: 'Status', size: 100,
        Cell: ({ cell }) => (
          <StatusBadge status={cell.getValue<boolean>() ? 'active' : 'inactive'} />
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
          <DropdownMenu trigger={
            <span className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">•••</span>
          }>
            <DropdownItem onClick={() => { setEditing(row.original); setDialogOpen(true) }}>
              <span className="flex items-center gap-2"><Pencil className="h-3.5 w-3.5" /> Edit</span>
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem destructive onClick={() => setConfirmDelete(row.original)}>
              <span className="flex items-center gap-2"><Trash2 className="h-3.5 w-3.5" /> Delete</span>
            </DropdownItem>
          </DropdownMenu>
        ),
      })
    }

    return base
  }, [isReadOnly])

  const handleSave = async (data: Form) => {
    try {
      const payload: SalaryStructureFormData = {
        employee: data.employee,
        basic_salary: data.basic_salary,
        housing_allowance: data.housing_allowance || '0',
        transport_allowance: data.transport_allowance || '0',
        other_allowances: data.other_allowances || '0',
        effective_from: data.effective_from,
        effective_to: data.effective_to || null,
        is_active: data.is_active,
      }
      if (editing) {
        await updateSalary.mutateAsync(payload)
        toast.success('Salary updated')
      } else {
        await createSalary.mutateAsync(payload)
        toast.success('Salary structure created')
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
        <p className="text-sm text-slate-500">
          Employee compensation structure. Every active employee should have one.
        </p>
        <WriteOnly>
          <Button onClick={() => { setEditing(null); setDialogOpen(true) }}>
            <Plus className="h-4 w-4" /> New Salary
          </Button>
        </WriteOnly>
      </div>

      <FilterBar active={Boolean(search)} onClear={() => setSearch('')}>
        <Input placeholder="Search employee…" value={search}
          onChange={(e) => setSearch(e.target.value)} className="w-64" />
      </FilterBar>

      <DataTable columns={columns} data={filtered} isLoading={isLoading}
        emptyTitle="No salary structures yet"
        emptyDescription="Create a salary structure for each employee before running payroll." />

      {dialogOpen && (
        <SalaryDialog
          key={editing?.id ?? 'new'}
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setEditing(null) }}
          onSubmit={handleSave}
          initial={editing}
          users={users}
          loading={createSalary.isPending || updateSalary.isPending}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return
          try {
            await deleteSalary.mutateAsync(confirmDelete.id)
            toast.success('Salary deleted')
          } catch { toast.error('Delete failed') }
        }}
        title="Delete this salary structure?"
        description={confirmDelete ? `Structure for ${confirmDelete.employee_name} will be removed.` : ''}
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  )
}

function SalaryDialog({
  open, onClose, onSubmit, initial, users, loading,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (d: Form) => void | Promise<void>
  initial: SalaryStructure | null
  users: { id: number; first_name: string; last_name: string; username: string }[]
  loading: boolean
}) {
  const today = new Date().toISOString().slice(0, 10)
  const { register, handleSubmit, control, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      employee: initial?.employee ?? 0,
      basic_salary: initial?.basic_salary ?? '',
      housing_allowance: initial?.housing_allowance ?? '0',
      transport_allowance: initial?.transport_allowance ?? '0',
      other_allowances: initial?.other_allowances ?? '0',
      effective_from: initial?.effective_from ?? today,
      effective_to: initial?.effective_to ?? '',
      is_active: initial?.is_active ?? true,
    },
  })

  const employeeOptions = users.map((u) => ({
    value: u.id,
    label: `${u.first_name} ${u.last_name}`.trim() || u.username,
  }))

  return (
    <Dialog open={open} onClose={onClose}
      title={initial ? 'Edit salary structure' : 'New salary structure'}
      className="max-w-xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Controller name="employee" control={control} render={({ field }) => (
          <FormCombobox label="Employee" required
            options={employeeOptions}
            value={field.value || null}
            onChange={(v) => field.onChange(Number(v) || 0)}
            error={errors.employee} />
        )} />

        <Controller name="basic_salary" control={control} render={({ field }) => (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Basic Salary <span className="text-red-500">*</span>
            </label>
            <CurrencyInput value={field.value} onChange={field.onChange}
              error={Boolean(errors.basic_salary)} />
            {errors.basic_salary && <p className="mt-1 text-xs text-red-600">{errors.basic_salary.message}</p>}
          </div>
        )} />

        <div className="grid grid-cols-3 gap-3">
          <Controller name="housing_allowance" control={control} render={({ field }) => (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Housing</label>
              <CurrencyInput value={field.value ?? ''} onChange={field.onChange} />
            </div>
          )} />
          <Controller name="transport_allowance" control={control} render={({ field }) => (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Transport</label>
              <CurrencyInput value={field.value ?? ''} onChange={field.onChange} />
            </div>
          )} />
          <Controller name="other_allowances" control={control} render={({ field }) => (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Other</label>
              <CurrencyInput value={field.value ?? ''} onChange={field.onChange} />
            </div>
          )} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Effective From" required type="date"
            error={errors.effective_from} {...register('effective_from')} />
          <FormField label="Effective To" type="date"
            error={errors.effective_to} {...register('effective_to')} />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
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