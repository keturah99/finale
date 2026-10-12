// ---------------------------------------------------------------------------
// Salary structures
// ---------------------------------------------------------------------------

export interface SalaryStructure {
  id: number
  employee: number
  employee_name: string
  basic_salary: string
  housing_allowance: string
  transport_allowance: string
  other_allowances: string
  gross_monthly: string
  effective_from: string
  effective_to: string | null
  is_active: boolean
  created_at: string
}

export interface SalaryStructureFormData {
  employee: number
  basic_salary: string
  housing_allowance: string
  transport_allowance: string
  other_allowances: string
  effective_from: string
  effective_to?: string | null
  is_active: boolean
}

// ---------------------------------------------------------------------------
// Payroll runs
// ---------------------------------------------------------------------------

export type PayrollRunStatus = 'draft' | 'processing' | 'completed' | 'cancelled'

export interface PayrollRun {
  id: number
  period_label: string
  period_start: string
  period_end: string
  status: PayrollRunStatus
  processed_by: number | null
  processed_at: string | null
  notes: string
  records?: PayrollRecord[]
  created_at: string
}

export interface PayrollRunFormData {
  period_label: string
  period_start: string
  period_end: string
  notes?: string
}

// ---------------------------------------------------------------------------
// Payroll records
// ---------------------------------------------------------------------------

export interface PayrollRecord {
  id: number
  employee: number
  employee_name: string
  basic_salary: string
  housing_allowance: string
  transport_allowance: string
  other_allowances: string
  gross_salary: string
  napsa_employee: string
  nhima_employee: string
  paye: string
  other_deductions: string
  total_deductions: string
  net_salary: string
  notes: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Bank exports
// ---------------------------------------------------------------------------

export interface BankExport {
  id: number
  payroll_run: number
  file_name: string
  total_amount: string
  employee_count: number
  exported_at: string
  exported_by: number | null
}