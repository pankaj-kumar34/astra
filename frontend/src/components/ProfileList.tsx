import { useState, useMemo } from 'react'
import { Profile, TunnelState, TunnelStatus, SERVICE_PRESETS } from '@/types'
import { StatusBadge } from './StatusBadge'
import { cn } from '@/lib/utils'
import { Server, Plus, Search, X, Radio } from 'lucide-react'

interface Props {
  profiles: Profile[]
  tunnelStates: Record<string, TunnelState>
  selectedId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDisconnectAll?: () => void
}

export function ProfileList({ profiles, tunnelStates, selectedId, onSelect, onNew, onDisconnectAll }: Props) {
  const [filter, setFilter] = useState('')

  const getState = (id: string): TunnelState =>
    tunnelStates[id] ?? { status: TunnelStatus.StatusIdle }

  const filteredProfiles = useMemo(() => {
    if (!filter.trim()) return profiles
    const q = filter.toLowerCase().trim()
    return profiles.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.host.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.forwards?.some(
          f =>
            f.service.toLowerCase().includes(q) ||
            f.label?.toLowerCase().includes(q) ||
            String(f.localPort).includes(q)
        )
    )
  }, [profiles, filter])

  const connectedCount = useMemo(() => {
    return profiles.filter(p => tunnelStates[p.id]?.status === TunnelStatus.StatusConnected).length
  }, [profiles, tunnelStates])

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-zinc-800/80 bg-zinc-900 text-zinc-200 select-none">
      {/* Brand Header — Taller and more generous breathing room */}
      <div className="border-b border-zinc-800/70 px-5 pt-6 pb-4.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-indigo-500/30 bg-linear-to-br from-indigo-500/20 via-zinc-800 to-zinc-900 shadow-inner shadow-indigo-500/10">
              <svg width="17" height="19" viewBox="0 0 11 13" fill="none">
                <defs>
                  <linearGradient id="boltGrad" x1="8" y1="0" x2="3" y2="13" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
                <path d="M7 0.5L1 7h4.5L4 12.5L10 6H5.5L7 0.5Z" fill="url(#boltGrad)" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-bold tracking-tight text-white">Astra</span>
              </div>
              <p className="mt-0.5 text-[11px] leading-tight font-normal text-zinc-400">
                SSH Tunnel Manager
              </p>
            </div>
          </div>

          <button
            onClick={onNew}
            title="Create new profile"
            className="flex size-8 cursor-pointer items-center justify-center rounded-xl border border-zinc-700/60 bg-zinc-800/90 text-zinc-300 shadow-xs transition-all duration-150 hover:border-indigo-500/40 hover:bg-indigo-600/20 hover:text-indigo-300 active:scale-95"
          >
            <Plus className="size-4" />
          </button>
        </div>

        {/* Quick Search */}
        {profiles.length > 2 && (
          <div className="relative mt-3.5">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter profiles..."
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950/60 py-1.5 pr-7 pl-8 text-xs text-zinc-200 transition-all placeholder:text-zinc-500 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 focus:outline-none"
            />
            {filter && (
              <button
                onClick={() => setFilter('')}
                className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer p-0.5 text-zinc-500 hover:text-zinc-300"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Section Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 text-xs font-medium text-zinc-400">
        <span className="text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
          Profiles
        </span>
        <span className="rounded bg-zinc-800/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
          {filteredProfiles.length}
        </span>
      </div>

      {/* Profiles List */}
      <div className="flex-1 space-y-1.5 overflow-y-auto px-3 py-1.5">
        {profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl border border-zinc-700/50 bg-zinc-800/60 text-zinc-500">
              <Server className="size-5" />
            </div>
            <p className="text-xs font-medium text-zinc-300">No profiles yet</p>
            <p className="mt-1 mb-3 text-[11px] text-zinc-500">Create your first bastion profile</p>
            <button
              onClick={onNew}
              className="cursor-pointer rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-indigo-500"
            >
              Add Profile
            </button>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500">
            No profiles match &ldquo;{filter}&rdquo;
          </div>
        ) : (
          filteredProfiles.map(profile => {
            const state = getState(profile.id)
            const isSelected = profile.id === selectedId
            const isConnected = state.status === TunnelStatus.StatusConnected
            const isConnecting = state.status === TunnelStatus.StatusConnecting
            const isError = state.status === TunnelStatus.StatusError

            return (
              <button
                key={profile.id}
                onClick={() => onSelect(profile.id)}
                className={cn(
                  'group relative block w-full cursor-pointer rounded-xl p-3 text-left transition-all duration-150',
                  isSelected
                    ? 'border border-zinc-700/90 bg-zinc-800 text-white shadow-sm'
                    : 'border border-transparent text-zinc-300 hover:border-zinc-800 hover:bg-zinc-800/40'
                )}
              >
                {/* Active Indicator Bar */}
                {isSelected && (
                  <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-indigo-500" />
                )}

                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors',
                        isConnected
                          ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-400'
                          : isConnecting
                          ? 'animate-pulse border border-amber-500/30 bg-amber-500/15 text-amber-400'
                          : isError
                          ? 'border border-rose-500/30 bg-rose-500/15 text-rose-400'
                          : isSelected
                          ? 'border border-zinc-600/50 bg-zinc-700/60 text-zinc-200'
                          : 'border border-zinc-700/40 bg-zinc-800/60 text-zinc-400 group-hover:text-zinc-200'
                      )}
                    >
                      <Server className="size-4.5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs leading-tight font-semibold">
                          {profile.name}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[11px] leading-tight text-zinc-400">
                        {profile.host || 'No host specified'}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 pt-1.5">
                    <StatusBadge status={state.status} size="sm" dark={true} />
                  </div>
                </div>

                {/* Forwards preview pills */}
                {(profile.forwards?.length ?? 0) > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5 pl-12">
                    {(profile.forwards ?? []).slice(0, 3).map(f => {
                      const preset = SERVICE_PRESETS[f.service]
                      const badgeClass = preset?.darkColor ?? 'bg-zinc-800 text-zinc-300 border-zinc-700/60'
                      return (
                        <span
                          key={f.id}
                          className={cn(
                            'rounded-md border px-2 py-0.5 font-mono text-[10px] leading-none',
                            badgeClass
                          )}
                        >
                          {f.service || f.localPort}
                        </span>
                      )
                    })}
                    {(profile.forwards?.length ?? 0) > 3 && (
                      <span className="px-1 py-0.5 font-mono text-[9px] text-zinc-500">
                        +{profile.forwards!.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </button>
            )
          })
        )}
      </div>

      {/* Footer Status Bar */}
      <div className="flex items-center justify-between border-t border-zinc-800/80 bg-zinc-950/40 px-5 py-3.5 text-xs text-zinc-400">
        <div className="flex min-w-0 items-center gap-2">
          <Radio className={cn('size-3.5 shrink-0', connectedCount > 0 ? 'animate-pulse text-emerald-400' : 'text-zinc-500')} />
          <span className="truncate text-[11px]">
            {connectedCount === 0
              ? 'No active tunnels'
              : `${connectedCount} ${connectedCount === 1 ? 'tunnel' : 'tunnels'} active`}
          </span>
        </div>
        {connectedCount > 0 && onDisconnectAll && (
          <button
            onClick={onDisconnectAll}
            className="shrink-0 cursor-pointer rounded-md px-2 py-1 text-[11px] font-medium text-rose-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
            title="Disconnect all profiles and stop all tunnels"
          >
            Disconnect All
          </button>
        )}
      </div>
    </aside>
  )
}
