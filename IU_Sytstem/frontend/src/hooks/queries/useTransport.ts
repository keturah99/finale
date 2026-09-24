import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  Vehicle,
  VehicleFormData,
  Driver,
  DriverFormData,
  Trailer,
  TrailerFormData,
  LicenseClass,
  TransportBooking,
  BookingFormData,
} from '@/types/transport'

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
// Keys
// ---------------------------------------------------------------------------

export const transportKeys = {
  all: ['transport'] as const,

  licenseClasses: () => [...transportKeys.all, 'license-classes'] as const,

  vehicles: (filters?: Record<string, unknown>) =>
    [...transportKeys.all, 'vehicles', filters] as const,
  vehicle: (id: number) => [...transportKeys.vehicles(), id] as const,

  drivers: (filters?: Record<string, unknown>) =>
    [...transportKeys.all, 'drivers', filters] as const,
  driver: (id: number) => [...transportKeys.drivers(), id] as const,

  trailers: (filters?: Record<string, unknown>) =>
    [...transportKeys.all, 'trailers', filters] as const,
  trailer: (id: number) => [...transportKeys.trailers(), id] as const,

  bookings: (filters?: Record<string, unknown>) =>
    [...transportKeys.all, 'bookings', filters] as const,
  booking: (id: number) => [...transportKeys.bookings(), id] as const,

  eligibleVehicles: (bookingId: number) =>
    [...transportKeys.all, 'eligible-vehicles', bookingId] as const,
  eligibleDrivers: (bookingId: number) =>
    [...transportKeys.all, 'eligible-drivers', bookingId] as const,
}

// ---------------------------------------------------------------------------
// License classes
// ---------------------------------------------------------------------------

export function useLicenseClasses() {
  return useQuery({
    queryKey: transportKeys.licenseClasses(),
    queryFn: () => fetchList<LicenseClass>('/api/transport/license-classes/'),
    staleTime: Infinity, // never changes
  })
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export function useVehicles(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: transportKeys.vehicles(filters),
    queryFn: () => fetchList<Vehicle>('/api/transport/vehicles/', filters),
  })
}

export function useVehicle(id: number | null) {
  return useQuery({
    queryKey: transportKeys.vehicle(id ?? 0),
    queryFn: async () => {
      const { data } = await api.get<Vehicle>(`/api/transport/vehicles/${id}/`)
      return data
    },
    enabled: id !== null,
  })
}

export function useCreateVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: VehicleFormData) => {
      const { data } = await api.post<Vehicle>('/api/transport/vehicles/', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: transportKeys.vehicles() }),
  })
}

export function useUpdateVehicle(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<VehicleFormData>) => {
      const { data } = await api.patch<Vehicle>(
        `/api/transport/vehicles/${id}/`,
        payload,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transportKeys.vehicles() })
      qc.invalidateQueries({ queryKey: transportKeys.vehicle(id) })
    },
  })
}

export function useDeleteVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/transport/vehicles/${id}/`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: transportKeys.vehicles() }),
  })
}

// ---------------------------------------------------------------------------
// Drivers
// ---------------------------------------------------------------------------

export function useDrivers(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: transportKeys.drivers(filters),
    queryFn: () => fetchList<Driver>('/api/transport/drivers/', filters),
  })
}

export function useDriver(id: number | null) {
  return useQuery({
    queryKey: transportKeys.driver(id ?? 0),
    queryFn: async () => {
      const { data } = await api.get<Driver>(`/api/transport/drivers/${id}/`)
      return data
    },
    enabled: id !== null,
  })
}

export function useCreateDriver() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: DriverFormData) => {
      const { data } = await api.post<Driver>('/api/transport/drivers/', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: transportKeys.drivers() }),
  })
}

export function useUpdateDriver(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<DriverFormData>) => {
      const { data } = await api.patch<Driver>(
        `/api/transport/drivers/${id}/`,
        payload,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transportKeys.drivers() })
      qc.invalidateQueries({ queryKey: transportKeys.driver(id) })
    },
  })
}

export function useDeleteDriver() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/transport/drivers/${id}/`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: transportKeys.drivers() }),
  })
}

// ---------------------------------------------------------------------------
// Trailers
// ---------------------------------------------------------------------------

export function useTrailers(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: transportKeys.trailers(filters),
    queryFn: () => fetchList<Trailer>('/api/transport/trailers/', filters),
  })
}

export function useCreateTrailer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: TrailerFormData) => {
      const { data } = await api.post<Trailer>('/api/transport/trailers/', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: transportKeys.trailers() }),
  })
}

export function useUpdateTrailer(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<TrailerFormData>) => {
      const { data } = await api.patch<Trailer>(
        `/api/transport/trailers/${id}/`,
        payload,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transportKeys.trailers() })
      qc.invalidateQueries({ queryKey: transportKeys.trailer(id) })
    },
  })
}

export function useDeleteTrailer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/transport/trailers/${id}/`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: transportKeys.trailers() }),
  })
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export function useBookings(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: transportKeys.bookings(filters),
    queryFn: () => fetchList<TransportBooking>('/api/transport/bookings/', filters),
  })
}

export function useBooking(id: number | null) {
  return useQuery({
    queryKey: transportKeys.booking(id ?? 0),
    queryFn: async () => {
      const { data } = await api.get<TransportBooking>(
        `/api/transport/bookings/${id}/`,
      )
      return data
    },
    enabled: id !== null,
  })
}

export function useCreateBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: BookingFormData) => {
      const { data } = await api.post<TransportBooking>(
        '/api/transport/bookings/',
        payload,
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: transportKeys.bookings() }),
  })
}

// ---------------------------------------------------------------------------
// Dispatch actions
// ---------------------------------------------------------------------------

export function useEligibleVehicles(bookingId: number | null) {
  return useQuery({
    queryKey: transportKeys.eligibleVehicles(bookingId ?? 0),
    queryFn: () =>
      fetchList<Vehicle>('/api/transport/vehicles/eligible-for-booking/', {
        booking_id: bookingId,
      }),
    enabled: bookingId !== null,
  })
}

export function useEligibleDrivers(bookingId: number | null) {
  return useQuery({
    queryKey: transportKeys.eligibleDrivers(bookingId ?? 0),
    queryFn: () =>
      fetchList<Driver>('/api/transport/drivers/eligible-for-booking/', {
        booking_id: bookingId,
      }),
    enabled: bookingId !== null,
  })
}

function useBookingAction(
  action: string,
  method: 'post' = 'post',
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body?: unknown }) => {
      const { data } = await api[method]<TransportBooking>(
        `/api/transport/bookings/${id}/${action}/`,
        body ?? {},
      )
      return data
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: transportKeys.bookings() })
      qc.invalidateQueries({ queryKey: transportKeys.booking(id) })
      qc.invalidateQueries({ queryKey: transportKeys.vehicles() })
      qc.invalidateQueries({ queryKey: transportKeys.drivers() })
      qc.invalidateQueries({ queryKey: transportKeys.trailers() })
    },
  })
}

export const useAssignVehicle = () => useBookingAction('assign-vehicle')
export const useAssignDriver = () => useBookingAction('assign-driver')
export const useAttachTrailers = () => useBookingAction('attach-trailers')
export const useUnassignBooking = () => useBookingAction('unassign')
export const useOverridePairing = () => useBookingAction('override-pairing')
export const useUpdateBookingStatus = () => useBookingAction('update-status')