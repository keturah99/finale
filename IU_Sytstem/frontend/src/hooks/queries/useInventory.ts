import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  Product, ProductFormData,
  StockMovement, StockMovementFormData,
  StockAlert,
} from '@/types/inventory'

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

export const inventoryKeys = {
  all: ['inventory'] as const,
  products: (filters?: Record<string, unknown>) =>
    [...inventoryKeys.all, 'products', filters] as const,
  product: (id: number) => [...inventoryKeys.products(), id] as const,
  movements: (filters?: Record<string, unknown>) =>
    [...inventoryKeys.all, 'movements', filters] as const,
  alerts: () => [...inventoryKeys.all, 'alerts'] as const,
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export function useProducts(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: inventoryKeys.products(filters),
    queryFn: () => fetchList<Product>('/api/inventory/products/', filters),
  })
}

export function useProduct(id: number | null) {
  return useQuery({
    queryKey: inventoryKeys.product(id ?? 0),
    queryFn: async () => {
      const { data } = await api.get<Product>(`/api/inventory/products/${id}/`)
      return data
    },
    enabled: id !== null,
  })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ProductFormData) => {
      const { data } = await api.post<Product>('/api/inventory/products/', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: inventoryKeys.products() }),
  })
}

export function useUpdateProduct(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<ProductFormData>) => {
      const { data } = await api.patch<Product>(
        `/api/inventory/products/${id}/`,
        payload,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.products() })
      qc.invalidateQueries({ queryKey: inventoryKeys.product(id) })
    },
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/inventory/products/${id}/`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: inventoryKeys.products() }),
  })
}

// ---------------------------------------------------------------------------
// Stock movements
// ---------------------------------------------------------------------------

export function useMovements(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: inventoryKeys.movements(filters),
    queryFn: () => fetchList<StockMovement>('/api/inventory/movements/', filters),
  })
}

export function useCreateMovement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: StockMovementFormData) => {
      const { data } = await api.post<StockMovement>(
        '/api/inventory/movements/',
        payload,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.movements() })
      qc.invalidateQueries({ queryKey: inventoryKeys.products() })
      qc.invalidateQueries({ queryKey: inventoryKeys.alerts() })
    },
  })
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export function useAlerts() {
  return useQuery({
    queryKey: inventoryKeys.alerts(),
    queryFn: () => fetchList<StockAlert>('/api/inventory/alerts/'),
  })
}

export function useResolveAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/api/inventory/alerts/${id}/resolve/`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: inventoryKeys.alerts() }),
  })
}