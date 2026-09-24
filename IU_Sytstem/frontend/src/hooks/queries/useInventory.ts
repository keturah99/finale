import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface Paginated<T> {
  results: T[]
}

interface Product {
  id: number
  sku: string
  name: string
  department: string
  unit_price: string
}

export function useProducts() {
  return useQuery({
    queryKey: ['inventory', 'products', 'all'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Product> | Product[]>(
        '/api/inventory/products/',
        { params: { page_size: 500 } },
      )
      return Array.isArray(data) ? data : data.results
    },
  })
}