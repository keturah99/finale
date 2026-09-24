// ---------------------------------------------------------------------------
// License classes
// ---------------------------------------------------------------------------

export interface LicenseClass {
  id: number
  code: string
  description: string
  max_tonnage: string | null
  allows_trailer: boolean
  requires_psv_for_public: boolean
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export type VehicleType =
  | 'small_car'
  | 'van'
  | 'canter'
  | 'fuso'
  | 'tipper'
  | 'semi_truck'

export type VehicleCategory = 'public' | 'private'

export type VehicleStatus = 'available' | 'on_trip' | 'maintenance' | 'retired'

export interface Vehicle {
  id: number
  registration_number: string
  make: string
  vehicle_type: VehicleType
  vehicle_type_display: string
  tonnage: string
  category: VehicleCategory
  category_display: string
  status: VehicleStatus
  primary_driver: number | null
  primary_driver_name: string | null
  notes: string
  created_at: string
}

export interface VehicleFormData {
  registration_number: string
  make: string
  vehicle_type: VehicleType
  tonnage: string
  category: VehicleCategory
  status: VehicleStatus
  primary_driver: number | null
  notes?: string
}

// ---------------------------------------------------------------------------
// Drivers
// ---------------------------------------------------------------------------

export type DriverStatus = 'available' | 'on_trip' | 'off_duty' | 'suspended'

export interface Driver {
  id: number
  user: number
  username: string
  full_name: string
  license_number: string
  license_expiry: string
  license_classes: string[]      // slug list from API
  class_codes: string[]          // sorted codes (read-only)
  has_psv: boolean
  status: DriverStatus
  created_at: string
}

export interface DriverFormData {
  user: number
  license_number: string
  license_expiry: string
  license_classes: string[]
  has_psv: boolean
  status: DriverStatus
}

// ---------------------------------------------------------------------------
// Trailers
// ---------------------------------------------------------------------------

export type TrailerStatus = 'available' | 'on_trip' | 'maintenance' | 'retired'

export interface Trailer {
  id: number
  registration_number: string
  make: string
  tonnage: string
  category: VehicleCategory
  status: TrailerStatus
  notes: string
  created_at: string
}

export interface TrailerFormData {
  registration_number: string
  make: string
  tonnage: string
  category: VehicleCategory
  status: TrailerStatus
  notes?: string
}

// ---------------------------------------------------------------------------
// Transport bookings
// ---------------------------------------------------------------------------

export type BookingStatus =
  | 'pending'
  | 'assigned'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'

export type CargoCategory = 'general' | 'dg' | 'bulk'

export type PairingSource = 'primary' | 'manual' | 'auto'

export interface TransportBooking {
  id: number
  customer_name: string
  customer_phone: string
  customer_email: string
  pickup_location: string
  delivery_location: string
  cargo_description: string
  cargo_weight_kg: string
  cargo_category: CargoCategory
  pickup_date: string
  delivery_date: string | null
  quoted_price: string | null
  assigned_vehicle: number | null
  assigned_vehicle_reg: string | null
  assigned_driver: number | null
  assigned_driver_name: string | null
  assigned_trailers: number[]
  assigned_trailer_regs: string[]
  pairing_source: PairingSource
  pairing_warning: string
  assigned_at: string | null
  status: BookingStatus
  notes: string
  created_at: string
  updated_at: string
}

export interface BookingFormData {
  customer_name: string
  customer_phone: string
  customer_email?: string
  pickup_location: string
  delivery_location: string
  cargo_description: string
  cargo_weight_kg: string
  cargo_category: CargoCategory
  pickup_date: string
  delivery_date?: string | null
  quoted_price?: string | null
  notes?: string
}