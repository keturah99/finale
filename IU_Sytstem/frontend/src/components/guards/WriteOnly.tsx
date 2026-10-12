import { useIsReadOnly } from '@/hooks/useIsReadOnly'

/**
 * Renders its children only if the current user can write.
 * Wrap any "New X" button, edit menu, or inline action in this.
 */
export function WriteOnly({ children }: { children: React.ReactNode }) {
  const isReadOnly = useIsReadOnly()
  if (isReadOnly) return null
  return <>{children}</>
}