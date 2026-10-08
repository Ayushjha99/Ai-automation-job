export function timeAgo(value: string | Date | null | undefined) {
  if (!value) return null
  const date = typeof value === 'string' ? new Date(value) : value
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export function sourceLabel(source: string) {
  const [provider] = source.split(':')
  return provider.charAt(0).toUpperCase() + provider.slice(1)
}

export function scoreTone(score: number | null) {
  if (score === null) return 'bg-muted text-muted-foreground'
  if (score >= 80) return 'bg-primary text-primary-foreground'
  if (score >= 60) return 'bg-primary/15 text-primary'
  return 'bg-muted text-muted-foreground'
}
