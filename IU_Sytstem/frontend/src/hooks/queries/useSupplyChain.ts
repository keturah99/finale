import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  Farmer, FarmerFormData,
  Crop,
  ProducePurchase, ProducePurchaseFormData,
  ProductionBatch, ProductionBatchFormData,
} from '@/types/supplychain'

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

export const scKeys = {
  all: ['supplychain'] as const,

  farmers: (filters?: Record<string, unknown>) =>
    [...scKeys.all, 'farmers', filters] as const,
  farmer: (id: number) => [...scKeys.farmers(), id] as const,

  crops: () => [...scKeys.all, 'crops'] as const,

  purchases: (filters?: Record<string, unknown>) =>
    [...scKeys.all, 'purchases', filters] as const,
  purchase: (id: number) => [...scKeys.purchases(), id] as const,

  batches: (filters?: Record<string, unknown>) =>
    [...scKeys.all, 'batches', filters] as const,
  batch: (id: number) => [...scKeys.batches(), id] as const,
}

// ---------------------------------------------------------------------------
// Farmers
// ---------------------------------------------------------------------------

export function useFarmers(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: scKeys.farmers(filters),
    queryFn: () => fetchList<Farmer>('/api/supplychain/farmers/', filters),
  })
}

export function useCreateFarmer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: FarmerFormData) => {
      const { data } = await api.post<Farmer>('/api/supplychain/farmers/', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: scKeys.farmers() }),
  })
}

export function useUpdateFarmer(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<FarmerFormData>) => {
      const { data } = await api.patch<Farmer>(
        `/api/supplychain/farmers/${id}/`,
        payload,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scKeys.farmers() })
      qc.invalidateQueries({ queryKey: scKeys.farmer(id) })
    },
  })
}

export function useDeleteFarmer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/supplychain/farmers/${id}/`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: scKeys.farmers() }),
  })
}

// ---------------------------------------------------------------------------
// Crops
// ---------------------------------------------------------------------------

export function useCrops() {
  return useQuery({
    queryKey: scKeys.crops(),
    queryFn: () => fetchList<Crop>('/api/supplychain/crops/'),
    staleTime: Infinity,
  })
}

// ---------------------------------------------------------------------------
// Produce purchases
// ---------------------------------------------------------------------------

export function usePurchases(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: scKeys.purchases(filters),
    queryFn: () => fetchList<ProducePurchase>('/api/supplychain/purchases/', filters),
  })
}

export function useCreatePurchase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ProducePurchaseFormData) => {
      const { data } = await api.post<ProducePurchase>(
        '/api/supplychain/purchases/',
        payload,
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: scKeys.purchases() }),
  })
}

export function useUpdatePurchase(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<ProducePurchaseFormData>) => {
      const { data } = await api.patch<ProducePurchase>(
        `/api/supplychain/purchases/${id}/`,
        payload,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scKeys.purchases() })
      qc.invalidateQueries({ queryKey: scKeys.purchase(id) })
    },
  })
}

export function useDeletePurchase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/supplychain/purchases/${id}/`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: scKeys.purchases() }),
  })
}

// ---------------------------------------------------------------------------
// Production batches
// ---------------------------------------------------------------------------

export function useBatches(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: scKeys.batches(filters),
    queryFn: () => fetchList<ProductionBatch>('/api/supplychain/batches/', filters),
  })
}

export function useCreateBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ProductionBatchFormData) => {
      const { data } = await api.post<ProductionBatch>(
        '/api/supplychain/batches/',
        payload,
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: scKeys.batches() }),
  })
}

export function useUpdateBatch(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<ProductionBatchFormData>) => {
      const { data } = await api.patch<ProductionBatch>(
        `/api/supplychain/batches/${id}/`,
        payload,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scKeys.batches() })
      qc.invalidateQueries({ queryKey: scKeys.batch(id) })
    },
  })
}

export function useCompleteBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      finished_product_qty_kg,
      finished_product_name,
      completion_date,
    }: {
      id: number
      finished_product_qty_kg: string
      finished_product_name: string
      completion_date: string
    }) => {
      const { data } = await api.post<ProductionBatch>(
        `/api/supplychain/batches/${id}/complete/`,
        { finished_product_qty_kg, finished_product_name, completion_date },
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: scKeys.batches() }),
  })
}

export function useDeleteBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/supplychain/batches/${id}/`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: scKeys.batches() }),
  })
}

