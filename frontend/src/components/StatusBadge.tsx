import { cn } from '@/lib/utils'
import { TunnelStatus } from '@/types'

interface Props {
  status: TunnelStatus
  size?: 'sm' | 'md'
  variant?: 'dot' | 'badge'
  dark?: boolean
  className?: string
}

export function StatusBadge({
  status,
  size = 'md',
  variant = 'dot',
  dark = false,
  className,
}: Props) {
  const isConnected = status === TunnelStatus.StatusConnected

  const config = {
    [TunnelStatus.StatusConnected]: {
      label: 'Connected',
      dot: 'bg-emerald-500',
      ping: 'bg-emerald-400',
      textLight: 'text-emerald-700',
      textDark: 'text-emerald-400',
      badgeLight: 'bg-emerald-50 border-emerald-200/80 text-emerald-700',
      badgeDark: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
    },
    [TunnelStatus.StatusConnecting]: {
      label: 'Connecting…',
      dot: 'bg-amber-500 animate-pulse',
      ping: 'bg-amber-400',
      textLight: 'text-amber-700',
      textDark: 'text-amber-400',
      badgeLight: 'bg-amber-50 border-amber-200/80 text-amber-700',
      badgeDark: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
    },
    [TunnelStatus.StatusError]: {
      label: 'Error',
      dot: 'bg-rose-500',
      ping: 'bg-rose-400',
      textLight: 'text-rose-700',
      textDark: 'text-rose-400',
      badgeLight: 'bg-rose-50 border-rose-200/80 text-rose-700',
      badgeDark: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
    },
    [TunnelStatus.StatusIdle]: {
      label: 'Idle',
      dot: dark ? 'bg-zinc-600' : 'bg-zinc-400',
      ping: '',
      textLight: 'text-zinc-500',
      textDark: 'text-zinc-400',
      badgeLight: 'bg-zinc-100 border-zinc-200 text-zinc-600',
      badgeDark: 'bg-zinc-800/80 border-zinc-700/60 text-zinc-400',
    },
    [TunnelStatus.$zero]: {
      label: 'Idle',
      dot: dark ? 'bg-zinc-600' : 'bg-zinc-400',
      ping: '',
      textLight: 'text-zinc-500',
      textDark: 'text-zinc-400',
      badgeLight: 'bg-zinc-100 border-zinc-200 text-zinc-600',
      badgeDark: 'bg-zinc-800/80 border-zinc-700/60 text-zinc-400',
    },
  }[status] ?? {
    label: 'Idle',
    dot: 'bg-zinc-400',
    ping: '',
    textLight: 'text-zinc-500',
    textDark: 'text-zinc-400',
    badgeLight: 'bg-zinc-100 border-zinc-200 text-zinc-600',
    badgeDark: 'bg-zinc-800/80 border-zinc-700/60 text-zinc-400',
  }

  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'

  if (variant === 'dot') {
    return (
      <span className={cn('relative inline-flex items-center justify-center shrink-0', dotSize, className)}>
        {isConnected && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
              config.ping
            )}
          />
        )}
        <span className={cn('relative inline-flex rounded-full', dotSize, config.dot)} />
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border font-medium select-none transition-colors duration-150',
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-xs',
        dark ? config.badgeDark : config.badgeLight,
        className
      )}
    >
      <span className={cn('relative inline-flex items-center justify-center shrink-0', dotSize)}>
        {isConnected && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
              config.ping
            )}
          />
        )}
        <span className={cn('relative inline-flex rounded-full', dotSize, config.dot)} />
      </span>
      <span>{config.label}</span>
    </span>
  )
}
