export function formatK(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'K 0.00'
  const n = typeof value === 'string' ? parseFloat(value) : value
  if (Number.isNaN(n)) return 'K 0.00'
  return `K ${n.toLocaleString('en-ZM', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function userFullName(u: { first_name?: string; last_name?: string; username?: string } | null): string {
  if (!u) return '—'
  const name = `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
  return name || u.username || '—'
}