import { cn } from '@/lib/utils'
import { TunnelStatus } from '@/types'

interface Props {
  status: TunnelStatus
  size?: 'sm' | 'md'
  dark?: boolean  // sidebar uses dark variant
}

// Light mode (content area)
const lightConfig: Record<TunnelStatus, { label: string; dot: string; text: string }> = {
  [TunnelStatus.StatusConnected]:  { label: 'Connected',  dot: 'bg-indigo-400',              text: 'text-indigo-600' },
  [TunnelStatus.StatusConnecting]: { label: 'Connecting', dot: 'bg-violet-400 animate-pulse', text: 'text-violet-600' },
  [TunnelStatus.StatusError]:      { label: 'Error',      dot: 'bg-red-500',                 text: 'text-red-600' },
  [TunnelStatus.StatusIdle]:       { label: 'Idle',       dot: 'bg-zinc-300',                text: 'text-zinc-400' },
  [TunnelStatus.$zero]:            { label: 'Idle',       dot: 'bg-zinc-300',                text: 'text-zinc-400' },
}

// Dark mode (sidebar)
const darkConfig: Record<TunnelStatus, { label: string; dot: string; text: string }> = {
  [TunnelStatus.StatusConnected]:  { label: 'Connected',  dot: 'bg-indigo-400 shadow-sm shadow-indigo-400/50', text: 'text-indigo-400' },
  [TunnelStatus.StatusConnecting]: { label: 'Connecting', dot: 'bg-violet-400 animate-pulse',                  text: 'text-violet-400' },
  [TunnelStatus.StatusError]:      { label: 'Error',      dot: 'bg-red-400',                                   text: 'text-red-400' },
  [TunnelStatus.StatusIdle]:       { label: 'Idle',       dot: 'bg-zinc-600',                                  text: 'text-zinc-500' },
  [TunnelStatus.$zero]:            { label: 'Idle',       dot: 'bg-zinc-600',                                  text: 'text-zinc-500' },
}

export function StatusBadge({ status, size = 'md', dark = true }: Props) {
  const config = dark ? darkConfig : lightConfig
  const c = config[status] ?? config[TunnelStatus.StatusIdle]
  return (
    <span className={cn('flex items-center gap-1.5', size === 'sm' ? 'text-xs' : 'text-sm')}>
      <span className={cn('rounded-full flex-shrink-0', c.dot, size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2')} />
      <span className={c.text}>{c.label}</span>
    </span>
  )
}
