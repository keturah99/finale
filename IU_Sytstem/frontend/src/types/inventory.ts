// frontend/src/types/inventory.ts

export type Department = 'groceries' | 'household' | 'hardware' | 'production'

export interface Product {
  id: number
  sku: string
  name: string
  department: Department
  category: string
  unit_price: string
  reorder_level: number
  is_active: boolean
  stock?: StockLevel
  created_at: string
  updated_at: string
}

export interface ProductFormData {
  sku: string
  name: string
  department: Department
  category?: string
  unit_price: string
  reorder_level: number
  is_active: boolean
}

export interface StockLevel {
  quantity_on_hand: number
  last_updated: string
}

export type MovementType = 'in' | 'out' | 'adjust'

export interface StockMovement {
  id: number
  product: number
  movement_type: MovementType
  quantity: number
  reference: string
  notes: string
  performed_by: number | null
  created_at: string
}

export interface StockMovementFormData {
  product: number
  movement_type: MovementType
  quantity: number
  reference?: string
  notes?: string
}

export interface StockAlert {
  id: number
  product: number
  product_sku: string
  alert_type: 'low' | 'out'
  message: string
  is_resolved: boolean
  created_at: string
}