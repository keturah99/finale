// frontend/src/types/supplychain.ts

// ---------------------------------------------------------------------------
// Farmers
// ---------------------------------------------------------------------------

export interface Farmer {
  id: number
  first_name: string
  last_name: string
  full_name: string
  phone: string
  nrc: string
  location: string
  notes: string
  is_active: boolean
  created_at: string
}

export interface FarmerFormData {
  first_name: string
  last_name: string
  phone?: string
  nrc?: string
  location?: string
  notes?: string
  is_active: boolean
}

// ---------------------------------------------------------------------------
// Crops
// ---------------------------------------------------------------------------

export type CropName = 'maize' | 'groundnuts' | 'soybeans' | 'sunflower' | 'other'

export interface Crop {
  id: number
  name: CropName
  display_name: string
  unit: string
}

// ---------------------------------------------------------------------------
// Produce purchases
// ---------------------------------------------------------------------------

export type PaymentStatus = 'pending' | 'paid' | 'partial'

export interface ProducePurchase {
  id: number
  farmer: number
  farmer_name: string
  crop: number
  crop_display: string
  quantity_kg: string
  price_per_kg: string
  total_amount: string
  amount_paid: string
  balance: string
  payment_status: PaymentStatus
  purchase_date: string
  recorded_by: number | null
  created_at: string
}

export interface ProducePurchaseFormData {
  farmer: number
  crop: number
  quantity_kg: string
  price_per_kg: string
  amount_paid?: string
  purchase_date: string
}

// ---------------------------------------------------------------------------
// Production batches
// ---------------------------------------------------------------------------

export type BatchStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled'

export interface ProductionBatch {
  id: number
  batch_number: string
  raw_material_name: string
  raw_material_qty_kg: string
  finished_product_name: string
  finished_product_qty_kg: string | null
  yield_percentage: string | null
  start_date: string
  completion_date: string | null
  status: BatchStatus
  notes: string
  created_at: string
}

export interface ProductionBatchFormData {
  batch_number: string
  raw_material_name: string
  raw_material_qty_kg: string
  finished_product_name?: string
  finished_product_qty_kg?: string | null
  start_date: string
  completion_date?: string | null
  status: BatchStatus
  notes?: string
}