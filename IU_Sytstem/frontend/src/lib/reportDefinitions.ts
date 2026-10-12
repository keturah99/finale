import type { ReportDef } from '@/types/reporting'

const FORMATS_ALL: ReportDef['formats'] = ['csv', 'xlsx', 'pdf']
const FORMATS_JSON: ReportDef['formats'] = ['json']

export const REPORT_DEFINITIONS: ReportDef[] = [
  // ---------- Inventory ----------
  {
    type: 'inventory_summary',
    label: 'Inventory Summary',
    description: 'Products and stock value grouped by department.',
    formats: FORMATS_ALL,
    filters: [],
  },
  {
    type: 'stock_movements',
    label: 'Stock Movements',
    description: 'Every stock-in, stock-out, and adjustment in a date range.',
    formats: FORMATS_ALL,
    filters: [
      { key: 'from', label: 'From', kind: 'date' },
      { key: 'to', label: 'To', kind: 'date' },
      {
        key: 'department',
        label: 'Department',
        kind: 'select',
        options: [
          { value: 'groceries', label: 'Groceries' },
          { value: 'household', label: 'Household' },
          { value: 'hardware', label: 'Hardware' },
          { value: 'production', label: 'Production' },
        ],
      },
    ],
  },
  {
    type: 'low_stock_alerts',
    label: 'Low Stock Alerts',
    description: 'Unresolved low-stock and out-of-stock alerts.',
    formats: FORMATS_ALL,
    filters: [],
  },

  // ---------- Supply Chain ----------
  {
    type: 'produce_purchases',
    label: 'Produce Purchases',
    description: 'Purchases from farmers, filtered by crop or date.',
    formats: FORMATS_ALL,
    filters: [
      { key: 'from', label: 'From', kind: 'date' },
      { key: 'to', label: 'To', kind: 'date' },
      {
        key: 'crop',
        label: 'Crop',
        kind: 'select',
        options: [
          { value: 'maize', label: 'Maize' },
          { value: 'groundnuts', label: 'Groundnuts' },
          { value: 'soybeans', label: 'Soybeans' },
          { value: 'sunflower', label: 'Sunflower' },
          { value: 'other', label: 'Other' },
        ],
      },
    ],
  },
  {
    type: 'production_batches',
    label: 'Production Batches',
    description: 'Raw material intake and finished output per batch.',
    formats: FORMATS_ALL,
    filters: [
      { key: 'from', label: 'From', kind: 'date' },
      { key: 'to', label: 'To', kind: 'date' },
    ],
  },
  {
    type: 'pending_collections',
    label: 'Pending Collections',
    description: 'Hardware laybys awaiting pickup.',
    formats: FORMATS_ALL,
    filters: [
      {
        key: 'status',
        label: 'Status',
        kind: 'select',
        options: [
          { value: 'pending', label: 'Pending' },
          { value: 'ready', label: 'Ready' },
          { value: 'collected', label: 'Collected' },
          { value: 'cancelled', label: 'Cancelled' },
        ],
      },
    ],
  },

  // ---------- Transport ----------
  {
    type: 'transport_bookings',
    label: 'Transport Bookings',
    description: 'All bookings in a date range, with optional status filter.',
    formats: FORMATS_ALL,
    filters: [
      { key: 'from', label: 'From', kind: 'date' },
      { key: 'to', label: 'To', kind: 'date' },
      {
        key: 'status',
        label: 'Status',
        kind: 'select',
        options: [
          { value: 'pending', label: 'Pending' },
          { value: 'assigned', label: 'Assigned' },
          { value: 'in_transit', label: 'In Transit' },
          { value: 'delivered', label: 'Delivered' },
          { value: 'cancelled', label: 'Cancelled' },
        ],
      },
    ],
  },
  {
    type: 'vehicle_utilization',
    label: 'Vehicle Utilization',
    description: 'Trips and cargo moved per vehicle.',
    formats: FORMATS_ALL,
    filters: [],
  },

  // ---------- Payroll ----------
  {
    type: 'payroll_summary',
    label: 'Payroll Summary',
    description: 'Payroll lines for a given run (defaults to latest completed).',
    formats: FORMATS_ALL,
    filters: [
      {
        key: 'run_id',
        label: 'Run ID',
        kind: 'text',
        placeholder: 'Leave empty for latest',
      },
    ],
  },

  // ---------- Wholesale ----------
  {
    type: 'wholesale_stock_summary',
    label: 'Wholesale Stock Summary',
    description: 'Current stock per outlet, per product.',
    formats: FORMATS_ALL,
    filters: [
      { key: 'wholesale', label: 'Wholesale ID', kind: 'text' },
      { key: 'product', label: 'Product ID', kind: 'text' },
    ],
  },
  {
    type: 'inter_wholesale_transfers',
    label: 'Inter-Wholesale Transfers',
    description: 'All transfers with their lifecycle timestamps.',
    formats: FORMATS_ALL,
    filters: [
      { key: 'from', label: 'From', kind: 'date' },
      { key: 'to', label: 'To', kind: 'date' },
      {
        key: 'status',
        label: 'Status',
        kind: 'select',
        options: [
          { value: 'pending', label: 'Pending' },
          { value: 'in_transit', label: 'In Transit' },
          { value: 'received', label: 'Received' },
          { value: 'cancelled', label: 'Cancelled' },
        ],
      },
    ],
  },
  {
    type: 'weekly_sales_summary',
    label: 'Weekly Sales Summary',
    description: 'Per-cycle financial summary: cash, expenses, damages, net.',
    formats: FORMATS_ALL,
    filters: [
      { key: 'from', label: 'From', kind: 'date' },
      { key: 'to', label: 'To', kind: 'date' },
      {
        key: 'status',
        label: 'Status',
        kind: 'select',
        options: [
          { value: 'open', label: 'Open' },
          { value: 'closed', label: 'Closed' },
        ],
      },
    ],
  },
  {
    type: 'wholesale_damage_summary',
    label: 'Wholesale Damage Summary',
    description: 'Aggregated damage losses across storage and weekly sales.',
    formats: FORMATS_ALL,
    filters: [
      { key: 'from', label: 'From', kind: 'date' },
      { key: 'to', label: 'To', kind: 'date' },
    ],
  },
  {
    type: 'wholesale_stock_movement',
    label: 'Wholesale Stock Movement',
    description: 'Chronological ledger of every wholesale movement.',
    formats: FORMATS_ALL,
    filters: [
      { key: 'from', label: 'From', kind: 'date' },
      { key: 'to', label: 'To', kind: 'date' },
      { key: 'wholesale', label: 'Wholesale ID', kind: 'text' },
    ],
  },

  // ---------- Executive ----------
  {
    type: 'executive_dashboard',
    label: 'Executive Dashboard',
    description: 'KPI summary across every module (JSON preview).',
    formats: FORMATS_JSON,
    filters: [],
  },
]

export function getReportDefinition(type: string): ReportDef | undefined {
  return REPORT_DEFINITIONS.find((r) => r.type === type)
}