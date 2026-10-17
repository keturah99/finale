import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, downloadFile } from '@/lib/api'
import type {
  SalaryStructure, SalaryStructureFormData,
  PayrollRun, PayrollRunFormData,
  PayrollRecord,
  BankExport,
} from '@/types/payroll'


// ---------------------------------------------------------------------------
// Pagination helper
// ---------------------------------------------------------------------------

interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

async function fetchList<T>(
  url: string,
  params?: Record<string, unknown>,
): Promise<T[]> {
  const { data } = await api.get<Paginated<T> | T[]>(url, { params })
  return Array.isArray(data) ? data : data.results
}


// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const payrollKeys = {
  all: ['payroll'] as const,

  salaries: (filters?: Record<string, unknown>) =>
    [...payrollKeys.all, 'salaries', filters] as const,
  salary: (id: number) => [...payrollKeys.salaries(), id] as const,

  runs: (filters?: Record<string, unknown>) =>
    [...payrollKeys.all, 'runs', filters] as const,
  run: (id: number) => [...payrollKeys.runs(), id] as const,
  runRecords: (id: number) => [...payrollKeys.run(id), 'records'] as const,

  records: (filters?: Record<string, unknown>) =>
    [...payrollKeys.all, 'records', filters] as const,
  myRecords: () => [...payrollKeys.all, 'records', 'mine'] as const,

  bankExports: () => [...payrollKeys.all, 'bank-exports'] as const,
}


// ---------------------------------------------------------------------------
// Salary structures
// ---------------------------------------------------------------------------

export function useSalaries(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: payrollKeys.salaries(filters),
    queryFn: () => fetchList<SalaryStructure>('/api/payroll/salaries/', filters),
  })
}

export function useSalary(id: number | null) {
  return useQuery({
    queryKey: payrollKeys.salary(id ?? 0),
    queryFn: async () => {
      const { data } = await api.get<SalaryStructure>(
        `/api/payroll/salaries/${id}/`,
      )
      return data
    },
    enabled: id !== null,
  })
}

export function useCreateSalary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: SalaryStructureFormData) => {
      const { data } = await api.post<SalaryStructure>(
        '/api/payroll/salaries/',
        payload,
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.salaries() }),
  })
}

export function useUpdateSalary(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<SalaryStructureFormData>) => {
      const { data } = await api.patch<SalaryStructure>(
        `/api/payroll/salaries/${id}/`,
        payload,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: payrollKeys.salaries() })
      qc.invalidateQueries({ queryKey: payrollKeys.salary(id) })
    },
  })
}

export function useDeleteSalary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/payroll/salaries/${id}/`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.salaries() }),
  })
}


// ---------------------------------------------------------------------------
// Payroll runs
// ---------------------------------------------------------------------------

export function usePayrollRuns(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: payrollKeys.runs(filters),
    queryFn: () => fetchList<PayrollRun>('/api/payroll/runs/', filters),
  })
}

export function usePayrollRun(id: number | null) {
  return useQuery({
    queryKey: payrollKeys.run(id ?? 0),
    queryFn: async () => {
      const { data } = await api.get<PayrollRun>(`/api/payroll/runs/${id}/`)
      return data
    },
    enabled: id !== null,
  })
}

export function useCreatePayrollRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: PayrollRunFormData) => {
      const { data } = await api.post<PayrollRun>('/api/payroll/runs/', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.runs() }),
  })
}

export function useProcessPayrollRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<{
        status: string
        period_label: string
        records_created: number
        processed_at: string
      }>(`/api/payroll/runs/${id}/process/`)
      return data
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: payrollKeys.runs() })
      qc.invalidateQueries({ queryKey: payrollKeys.run(id) })
      qc.invalidateQueries({ queryKey: payrollKeys.runRecords(id) })
      qc.invalidateQueries({ queryKey: payrollKeys.myRecords() })
    },
  })
}

export function useRunRecords(runId: number | null) {
  return useQuery({
    queryKey: payrollKeys.runRecords(runId ?? 0),
    queryFn: () =>
      fetchList<PayrollRecord>(`/api/payroll/runs/${runId}/records/`),
    enabled: runId !== null,
  })
}


// ---------------------------------------------------------------------------
// Bank export — generate from a run (POST)
// ---------------------------------------------------------------------------

export function useExportBank() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      periodLabel,
    }: {
      id: number
      periodLabel: string
    }) => {
      const filename = `bank_export_${periodLabel.replace(/\s+/g, '_')}.csv`
      await downloadFile(
        `/api/payroll/runs/${id}/export_bank/`,
        filename,
        'post',
      )
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: payrollKeys.bankExports() }),
  })
}


// ---------------------------------------------------------------------------
// Bank export — download a historical export (GET)
// ---------------------------------------------------------------------------

export function useDownloadBankExport() {
  return useMutation({
    mutationFn: async ({
      id,
      fileName,
    }: {
      id: number
      fileName: string
    }) => {
      await downloadFile(
        `/api/payroll/bank-exports/${id}/download/`,
        fileName,
        'get',
      )
    },
  })
}


// ---------------------------------------------------------------------------
// Payroll records (officer view)
// ---------------------------------------------------------------------------

export function usePayrollRecords(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: payrollKeys.records(filters),
    queryFn: () => fetchList<PayrollRecord>('/api/payroll/records/', filters),
  })
}


// ---------------------------------------------------------------------------
// My payslips
// ---------------------------------------------------------------------------

export function useMyPayslips() {
  return useQuery({
    queryKey: payrollKeys.myRecords(),
    queryFn: () => fetchList<PayrollRecord>('/api/payroll/records/mine/'),
  })
}

export function useDownloadPayslip() {
  return useMutation({
    mutationFn: async ({
      id,
      employeeName,
      period,
    }: {
      id: number
      employeeName: string
      period: string
    }) => {
      const cleanName = employeeName.replace(/\s+/g, '_')
      const cleanPeriod = period.replace(/\s+/g, '_')
      const filename = `payslip_${cleanName}_${cleanPeriod}.pdf`
      await downloadFile(`/api/payroll/records/${id}/payslip/`, filename, 'get')
    },
  })
}


// ---------------------------------------------------------------------------
// Bank exports history
// ---------------------------------------------------------------------------

export function useBankExports() {
  return useQuery({
    queryKey: payrollKeys.bankExports(),
    queryFn: () => fetchList<BankExport>('/api/payroll/bank-exports/'),
  })
}