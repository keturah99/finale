import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  Wholesale,
  WholesaleFormData,
  StockLevel,
  StockIn,
  StockOut,
  Damage,
  Transfer,
  WeeklySales,
  WeeklySalesCashIn,
  WeeklySalesExpense,
  WeeklySalesDamage,
  WeeklySalesSummary,
} from '@/types/wholesale'

import type { PendingCollection, PendingCollectionFormData } from '@/types/wholesale'


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
  // DRF pagination wraps results; unwrap when present
  if (Array.isArray(data)) return data
  return data.results
}

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const wholesaleKeys = {
  all: ['wholesale'] as const,
  outlets: () => [...wholesaleKeys.all, 'outlets'] as const,
  outlet: (id: number) => [...wholesaleKeys.outlets(), id] as const,
  stockLevels: (filters?: Record<string, unknown>) =>
    [...wholesaleKeys.all, 'stock-levels', filters] as const,
  stockIns: (filters?: Record<string, unknown>) =>
    [...wholesaleKeys.all, 'stock-in', filters] as const,
  stockOuts: (filters?: Record<string, unknown>) =>
    [...wholesaleKeys.all, 'stock-out', filters] as const,
  damages: (filters?: Record<string, unknown>) =>
    [...wholesaleKeys.all, 'damages', filters] as const,
  transfers: (filters?: Record<string, unknown>) =>
    [...wholesaleKeys.all, 'transfers', filters] as const,
  transfer: (id: number) => [...wholesaleKeys.transfers(), id] as const,
  weeklySales: (filters?: Record<string, unknown>) =>
    [...wholesaleKeys.all, 'weekly-sales', filters] as const,
  weeklySale: (id: number) => [...wholesaleKeys.weeklySales(), id] as const,
  weeklySummary: (id: number) =>
    [...wholesaleKeys.weeklySale(id), 'summary'] as const,
  cashIns: (filters?: Record<string, unknown>) =>
    [...wholesaleKeys.all, 'cash-ins', filters] as const,
  expenses: (filters?: Record<string, unknown>) =>
    [...wholesaleKeys.all, 'expenses', filters] as const,
  weeklyDamages: (filters?: Record<string, unknown>) =>
    [...wholesaleKeys.all, 'weekly-damages', filters] as const,
  collections: (filters?: Record<string, unknown>) =>
  [...wholesaleKeys.all, 'collections', filters] as const,
  collection: (id: number) => [...wholesaleKeys.collections(), id] as const,
}

// ---------------------------------------------------------------------------
// Outlets
// ---------------------------------------------------------------------------

export function useOutlets() {
  return useQuery({
    queryKey: wholesaleKeys.outlets(),
    queryFn: () => fetchList<Wholesale>('/api/wholesale/wholesales/'),
  })
}

export function useOutlet(id: number | null) {
  return useQuery({
    queryKey: wholesaleKeys.outlet(id ?? 0),
    queryFn: async () => {
      const { data } = await api.get<Wholesale>(`/api/wholesale/wholesales/${id}/`)
      return data
    },
    enabled: id !== null,
  })
}

export function useCreateOutlet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: WholesaleFormData) => {
      const { data } = await api.post<Wholesale>('/api/wholesale/wholesales/', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: wholesaleKeys.outlets() }),
  })
}

export function useUpdateOutlet(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<WholesaleFormData>) => {
      const { data } = await api.patch<Wholesale>(
        `/api/wholesale/wholesales/${id}/`,
        payload,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wholesaleKeys.outlets() })
      qc.invalidateQueries({ queryKey: wholesaleKeys.outlet(id) })
    },
  })
}

export function useDeleteOutlet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/wholesale/wholesales/${id}/`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: wholesaleKeys.outlets() }),
  })
}

// ---------------------------------------------------------------------------
// Stock levels
// ---------------------------------------------------------------------------

export function useStockLevels(filters?: { wholesale?: number; product?: number }) {
  return useQuery({
    queryKey: wholesaleKeys.stockLevels(filters),
    queryFn: () => fetchList<StockLevel>('/api/wholesale/stock-levels/', filters),
  })
}

// ---------------------------------------------------------------------------
// Stock in / out
// ---------------------------------------------------------------------------

export function useStockIns(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: wholesaleKeys.stockIns(filters),
    queryFn: () => fetchList<StockIn>('/api/wholesale/stock-in/', filters),
  })
}

export function useCreateStockIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<StockIn>) => {
      const { data } = await api.post<StockIn>('/api/wholesale/stock-in/', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wholesaleKeys.stockIns() })
      qc.invalidateQueries({ queryKey: wholesaleKeys.stockLevels() })
    },
  })
}

export function useStockOuts(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: wholesaleKeys.stockOuts(filters),
    queryFn: () => fetchList<StockOut>('/api/wholesale/stock-out/', filters),
  })
}

export function useCreateStockOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<StockOut>) => {
      const { data } = await api.post<StockOut>('/api/wholesale/stock-out/', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wholesaleKeys.stockOuts() })
      qc.invalidateQueries({ queryKey: wholesaleKeys.stockLevels() })
    },
  })
}

// ---------------------------------------------------------------------------
// Damages
// ---------------------------------------------------------------------------

export function useDamages(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: wholesaleKeys.damages(filters),
    queryFn: () => fetchList<Damage>('/api/wholesale/damages/', filters),
  })
}

export function useCreateDamage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: FormData | Partial<Damage>) => {
      const isForm = payload instanceof FormData
      const { data } = await api.post<Damage>('/api/wholesale/damages/', payload, {
        headers: isForm ? { 'Content-Type': 'multipart/form-data' } : undefined,
      })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wholesaleKeys.damages() })
      qc.invalidateQueries({ queryKey: wholesaleKeys.stockLevels() })
    },
  })
}

// ---------------------------------------------------------------------------
// Transfers
// ---------------------------------------------------------------------------

export function useTransfers(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: wholesaleKeys.transfers(filters),
    queryFn: () => fetchList<Transfer>('/api/wholesale/transfers/', filters),
  })
}

export function useTransfer(id: number | null) {
  return useQuery({
    queryKey: wholesaleKeys.transfer(id ?? 0),
    queryFn: async () => {
      const { data } = await api.get<Transfer>(`/api/wholesale/transfers/${id}/`)
      return data
    },
    enabled: id !== null,
  })
}

export function useCreateTransfer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<Transfer>) => {
      const { data } = await api.post<Transfer>('/api/wholesale/transfers/', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: wholesaleKeys.transfers() }),
  })
}

function useTransferAction(action: 'approve' | 'receive' | 'cancel') {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<Transfer>(
        `/api/wholesale/transfers/${id}/${action}/`,
      )
      return data
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: wholesaleKeys.transfers() })
      qc.invalidateQueries({ queryKey: wholesaleKeys.transfer(id) })
      qc.invalidateQueries({ queryKey: wholesaleKeys.stockLevels() })
    },
  })
}

export const useApproveTransfer = () => useTransferAction('approve')
export const useReceiveTransfer = () => useTransferAction('receive')
export const useCancelTransfer = () => useTransferAction('cancel')

// ---------------------------------------------------------------------------
// Weekly sales
// ---------------------------------------------------------------------------

export function useWeeklySales(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: wholesaleKeys.weeklySales(filters),
    queryFn: () => fetchList<WeeklySales>('/api/wholesale/weekly-sales/', filters),
  })
}

export function useWeeklySale(id: number | null) {
  return useQuery({
    queryKey: wholesaleKeys.weeklySale(id ?? 0),
    queryFn: async () => {
      const { data } = await api.get<WeeklySales>(
        `/api/wholesale/weekly-sales/${id}/`,
      )
      return data
    },
    enabled: id !== null,
  })
}

export function useWeeklySummary(id: number | null) {
  return useQuery({
    queryKey: wholesaleKeys.weeklySummary(id ?? 0),
    queryFn: async () => {
      const { data } = await api.get<WeeklySalesSummary>(
        `/api/wholesale/weekly-sales/${id}/summary/`,
      )
      return data
    },
    enabled: id !== null,
  })
}

export function useCreateWeeklySales() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<WeeklySales>) => {
      const { data } = await api.post<WeeklySales>(
        '/api/wholesale/weekly-sales/',
        payload,
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: wholesaleKeys.weeklySales() }),
  })
}

export function useCloseAndOpenNext() {
  const qc = useQueryClient()
  return useMutation<
    { closed: WeeklySales; opened: WeeklySales },
    Error,
    { id: number; days?: number }
  >({
    mutationFn: async ({ id, days = 7 }) => {
      const { data } = await api.post<{ closed: WeeklySales; opened: WeeklySales }>(
        `/api/wholesale/weekly-sales/${id}/close-and-open-next/`,
        { days },
      )
      return data
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: wholesaleKeys.weeklySales() })
      qc.invalidateQueries({ queryKey: wholesaleKeys.weeklySale(id) })
    },
  })
}

// ---------------------------------------------------------------------------
// Cash-ins / expenses / weekly damages
// ---------------------------------------------------------------------------

export function useCashIns(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: wholesaleKeys.cashIns(filters),
    queryFn: () => fetchList<WeeklySalesCashIn>('/api/wholesale/cash-ins/', filters),
  })
}

export function useCreateCashIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<WeeklySalesCashIn>) => {
      const { data } = await api.post<WeeklySalesCashIn>(
        '/api/wholesale/cash-ins/',
        payload,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wholesaleKeys.cashIns() })
      qc.invalidateQueries({ queryKey: wholesaleKeys.weeklySales() })
    },
  })
}

export function useExpenses(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: wholesaleKeys.expenses(filters),
    queryFn: () => fetchList<WeeklySalesExpense>('/api/wholesale/expenses/', filters),
  })
}

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<WeeklySalesExpense>) => {
      const { data } = await api.post<WeeklySalesExpense>(
        '/api/wholesale/expenses/',
        payload,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wholesaleKeys.expenses() })
      qc.invalidateQueries({ queryKey: wholesaleKeys.weeklySales() })
    },
  })
}

export function useWeeklyDamages(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: wholesaleKeys.weeklyDamages(filters),
    queryFn: () => fetchList<WeeklySalesDamage>('/api/wholesale/weekly-damages/', filters),
  })
}

export function useCreateWeeklyDamage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: FormData | Partial<WeeklySalesDamage>) => {
      const isForm = payload instanceof FormData
      const { data } = await api.post<WeeklySalesDamage>(
        '/api/wholesale/weekly-damages/',
        payload,
        { headers: isForm ? { 'Content-Type': 'multipart/form-data' } : undefined },
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wholesaleKeys.weeklyDamages() })
      qc.invalidateQueries({ queryKey: wholesaleKeys.weeklySales() })
    },
  })
}

// ---------------------------------------------------------------------------
// Pending collections (laybys)
// ---------------------------------------------------------------------------


export function useCollections(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: wholesaleKeys.collections(filters),
    queryFn: () => fetchList<PendingCollection>('/api/wholesale/collections/', filters),
  })
}

export function useCreateCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: PendingCollectionFormData) => {
      const { data } = await api.post<PendingCollection>(
        '/api/wholesale/collections/',
        payload,
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: wholesaleKeys.collections() }),
  })
}

export function useUpdateCollection(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PendingCollectionFormData>) => {
      const { data } = await api.patch<PendingCollection>(
        `/api/wholesale/collections/${id}/`,
        payload,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wholesaleKeys.collections() })
      qc.invalidateQueries({ queryKey: wholesaleKeys.collection(id) })
    },
  })
}

export function useMarkCollected() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<PendingCollection>(
        `/api/wholesale/collections/${id}/mark_collected/`,
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: wholesaleKeys.collections() }),
  })
}

export function useDeleteCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/wholesale/collections/${id}/`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: wholesaleKeys.collections() }),
  })
}