import { Profile, TunnelState, TunnelStatus, SERVICE_PRESETS } from '@/types'
import { StatusBadge } from './StatusBadge'
import { cn } from '@/lib/utils'
import { Zap, Plus } from 'lucide-react'

interface Props {
  profiles: Profile[]
  tunnelStates: Record<string, TunnelState>
  selectedId: string | null
  onSelect: (id: string) => void
  onNew: () => void
}

export function ProfileList({ profiles, tunnelStates, selectedId, onSelect, onNew }: Props) {
  const getState = (id: string): TunnelState =>
    tunnelStates[id] ?? { status: TunnelStatus.StatusIdle }

  const connected = profiles.filter(p => getState(p.id).status === TunnelStatus.StatusConnected).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div
       
        style={{ padding: '14px 14px 14px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Logo */}
            <div style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0,
              background: 'linear-gradient(135deg, #A89EEF, #7C6FE0)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(124,111,224,0.45)',
            }}>
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>Astra</span>
            {connected > 0 && (
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 99, fontWeight: 600,
                background: 'rgba(124,111,224,0.2)', color: '#A89EEF', border: '1px solid rgba(124,111,224,0.3)',
              }}>{connected}</span>
            )}
          </div>
          <button onClick={onNew} className="no-drag" style={{
            width: 22, height: 22, borderRadius: 6, cursor: 'pointer',
            background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
            title="New profile"
          >
            <Plus style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.8)' }} />
          </button>
        </div>
      </div>

      {/* Section label */}
      <div style={{ padding: '12px 14px 5px' }}>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.5)' }}>
          Profiles
        </span>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 8px' }}>
        {profiles.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 8px', gap: 8, textAlign: 'center' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.45)' }} />
            </div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>No profiles yet</span>
            <button onClick={onNew} style={{ background: 'none', border: 'none', fontSize: 11, color: '#A89EEF', cursor: 'pointer', padding: 0 }}>
              Create one →
            </button>
          </div>
        ) : (
          profiles.map(profile => {
            const state = getState(profile.id)
            const isSelected = profile.id === selectedId
            const isConnected = state.status === TunnelStatus.StatusConnected

            return (
              <button key={profile.id} onClick={() => onSelect(profile.id)} style={{
                width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 8,
                cursor: 'pointer', display: 'block', marginBottom: 2,
                background: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent',
                border: isSelected ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
              }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                      background: isConnected ? 'rgba(124,111,224,0.2)' : 'rgba(255,255,255,0.08)',
                      border: `1px solid ${isConnected ? 'rgba(124,111,224,0.35)' : 'rgba(255,255,255,0.12)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Zap style={{ width: 12, height: 12, color: isConnected ? '#A89EEF' : 'rgba(255,255,255,0.35)' }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{
                        fontSize: 12, fontWeight: 500, margin: 0, letterSpacing: '-0.01em',
                        color: isSelected ? '#fff' : 'rgba(255,255,255,0.9)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{profile.name}</p>
                      <p style={{
                        fontSize: 10, margin: '2px 0 0', color: 'rgba(255,255,255,0.55)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{profile.host || 'No host set'}</p>
                    </div>
                  </div>
                  <StatusBadge status={state.status} size="sm" />
                </div>
                {(profile.forwards?.length ?? 0) > 0 && (
                  <div style={{ marginTop: 5, paddingLeft: 35, display: 'flex', flexWrap: 'wrap' as const, gap: 3 }}>
                    {(profile.forwards ?? []).slice(0, 3).map(f => (
                      <span key={f.id} className={cn('text-[9px] px-1.5 py-0.5 rounded border',
                        SERVICE_PRESETS[f.service]?.color ?? 'bg-zinc-700/40 text-zinc-500 border-zinc-700')}>
                        {f.label || SERVICE_PRESETS[f.service]?.label}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 14px' }} />
    </div>
  )
}
