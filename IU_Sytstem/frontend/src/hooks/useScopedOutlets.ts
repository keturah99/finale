import { useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useOutlets } from '@/hooks/queries/useWholesale'
import type { Wholesale } from '@/types/wholesale'

export function useScopedOutlets() {
  const { user } = useAuth()
  const { data: allOutlets = [], ...rest } = useOutlets()

  const outlets = useMemo<Wholesale[]>(
    () =>
      user?.wholesale
        ? allOutlets.filter((o) => o.id === user.wholesale!.id)
        : allOutlets,
    [allOutlets, user],
  )

  return { outlets, ...rest }
}