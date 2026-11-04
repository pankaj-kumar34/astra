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
    <aside className="w-72 shrink-0 flex flex-col h-full bg-zinc-900 border-r border-zinc-800/80 select-none text-zinc-200">
      {/* Brand Header — Taller and more generous breathing room */}
      <div className="px-5 pt-6 pb-4.5 border-b border-zinc-800/70">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-indigo-500/20 via-zinc-800 to-zinc-900 border border-indigo-500/30 flex items-center justify-center shadow-inner shadow-indigo-500/10 shrink-0">
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
              <p className="text-[11px] text-zinc-400 font-normal leading-tight mt-0.5">
                SSH Tunnel Manager
              </p>
            </div>
          </div>

          <button
            onClick={onNew}
            title="Create new profile"
            className="w-8 h-8 rounded-xl bg-zinc-800/90 hover:bg-indigo-600/20 hover:border-indigo-500/40 text-zinc-300 hover:text-indigo-300 border border-zinc-700/60 flex items-center justify-center transition-all duration-150 active:scale-95 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Search */}
        {profiles.length > 2 && (
          <div className="mt-3.5 relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter profiles..."
              className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
            {filter && (
              <button
                onClick={() => setFilter('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Section Header */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between text-xs font-medium text-zinc-400">
        <span className="text-[10px] font-semibold tracking-wider uppercase text-zinc-400">
          Profiles
        </span>
        <span className="text-[10px] text-zinc-400 font-mono bg-zinc-800/60 px-1.5 py-0.5 rounded">
          {filteredProfiles.length}
        </span>
      </div>

      {/* Profiles List */}
      <div className="flex-1 overflow-y-auto px-3 py-1.5 space-y-1.5">
        {profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center text-zinc-500 mb-3">
              <Server className="w-5 h-5" />
            </div>
            <p className="text-xs font-medium text-zinc-300">No profiles yet</p>
            <p className="text-[11px] text-zinc-500 mt-1 mb-3">Create your first bastion profile</p>
            <button
              onClick={onNew}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer shadow-sm"
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
                  'w-full text-left rounded-xl p-3 transition-all duration-150 cursor-pointer block group relative',
                  isSelected
                    ? 'bg-zinc-800 text-white border border-zinc-700/90 shadow-sm'
                    : 'text-zinc-300 hover:bg-zinc-800/40 border border-transparent hover:border-zinc-800'
                )}
              >
                {/* Active Indicator Bar */}
                {isSelected && (
                  <span className="absolute left-0 top-3 bottom-3 w-1 bg-indigo-500 rounded-r-full" />
                )}

                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                        isConnected
                          ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                          : isConnecting
                          ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400 animate-pulse'
                          : isError
                          ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                          : isSelected
                          ? 'bg-zinc-700/60 border border-zinc-600/50 text-zinc-200'
                          : 'bg-zinc-800/60 border border-zinc-700/40 text-zinc-400 group-hover:text-zinc-200'
                      )}
                    >
                      <Server className="w-4.5 h-4.5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold truncate leading-tight">
                          {profile.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 font-mono truncate mt-0.5 leading-tight">
                        {profile.host || 'No host specified'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-1.5 shrink-0">
                    <StatusBadge status={state.status} size="sm" dark={true} />
                  </div>
                </div>

                {/* Forwards preview pills */}
                {(profile.forwards?.length ?? 0) > 0 && (
                  <div className="mt-2.5 pl-12 flex flex-wrap gap-1.5">
                    {(profile.forwards ?? []).slice(0, 3).map(f => {
                      const preset = SERVICE_PRESETS[f.service]
                      const badgeClass = preset?.darkColor ?? 'bg-zinc-800 text-zinc-300 border-zinc-700/60'
                      return (
                        <span
                          key={f.id}
                          className={cn(
                            'text-[10px] font-mono px-2 py-0.5 rounded-md border leading-none',
                            badgeClass
                          )}
                        >
                          {f.service || f.localPort}
                        </span>
                      )
                    })}
                    {(profile.forwards?.length ?? 0) > 3 && (
                      <span className="text-[9px] text-zinc-500 font-mono px-1 py-0.5">
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
      <div className="px-5 py-3.5 border-t border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between text-xs text-zinc-400">
        <div className="flex items-center gap-2 min-w-0">
          <Radio className={cn('w-3.5 h-3.5 shrink-0', connectedCount > 0 ? 'text-emerald-400 animate-pulse' : 'text-zinc-500')} />
          <span className="text-[11px] truncate">
            {connectedCount === 0
              ? 'No active tunnels'
              : `${connectedCount} ${connectedCount === 1 ? 'tunnel' : 'tunnels'} active`}
          </span>
        </div>
        {connectedCount > 0 && onDisconnectAll && (
          <button
            onClick={onDisconnectAll}
            className="text-[11px] font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2 py-1 rounded-md transition-colors cursor-pointer shrink-0"
            title="Disconnect all profiles and stop all tunnels"
          >
            Disconnect All
          </button>
        )}
      </div>
    </aside>
  )
}
