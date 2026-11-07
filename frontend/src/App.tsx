import { useState } from 'react'
import { useAstra } from './useAstra'
import { ProfileList } from './components/ProfileList'
import { ProfileDetail } from './components/ProfileDetail'
import { ProfileForm } from './components/ProfileForm'
import { Profile } from './types'
import { TooltipProvider } from '@/components/ui/tooltip'

type View = 'detail' | 'form'

export default function App() {
  const {
    profiles, tunnelStates, selectedProfileId, selectedProfile, loading,
    setSelectedProfileId, getTunnelState, saveProfile, deleteProfile, duplicateProfile, connect, disconnect,
  } = useAstra()

  const [view, setView] = useState<View>('detail')
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)

  function openNew() { setEditingProfile(null); setView('form') }
  function openEdit(p: Profile) { setEditingProfile(p); setView('form') }
  async function handleSave(p: Profile) {
    const saved = await saveProfile(p)
    setSelectedProfileId(saved.id)
    setView('detail')
  }
  async function handleDelete(id: string) { await deleteProfile(id); setView('detail') }
  function handleSelect(id: string) { setSelectedProfileId(id); setView('detail') }

  return (
    <TooltipProvider>
      <div style={{
        display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden',
        background: '#f4f4f5',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
        WebkitFontSmoothing: 'antialiased',
      } as React.CSSProperties}>

        {/* Double-click empty title bar to maximise — handled per-panel in headers */}

        {/* Sidebar — zinc-700, forced dark rendering */}
        <div style={{
          width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column',
          background: '#2d2d32',
          borderRight: '1px solid #222226',
          colorScheme: 'light',
        } as React.CSSProperties}>
          <ProfileList
            profiles={profiles} tunnelStates={tunnelStates}
            selectedId={selectedProfileId} onSelect={handleSelect} onNew={openNew}
          />
        </div>

        {/* Content — light, forced light rendering */}
        <div style={{ flex: 1, overflow: 'hidden', background: '#f6f6f7', display: 'flex', flexDirection: 'column', position: 'relative', colorScheme: 'light' } as React.CSSProperties}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #d4d4d8', borderTopColor: '#7C6FE0', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : view === 'form' ? (
            <ProfileForm profile={editingProfile} onSave={handleSave} onCancel={() => setView('detail')} />
          ) : selectedProfile ? (
            <ProfileDetail
              profile={selectedProfile} state={getTunnelState(selectedProfile.id)}
              onConnect={() => connect(selectedProfile.id)}
              onDisconnect={() => disconnect(selectedProfile.id)}
              onEdit={() => openEdit(selectedProfile)}
              onDelete={() => handleDelete(selectedProfile.id)}
              onDuplicate={() => duplicateProfile(selectedProfile.id)}
            />
          ) : (
            <EmptyState onNew={openNew} />
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

import React from 'react'

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: '-40px' }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: '#f0f0ff',
        border: '1px solid #c4c0f8',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#7C6FE0" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#18181b', fontSize: 14, fontWeight: 600, margin: '0 0 5px', letterSpacing: '-0.01em' }}>
          No profile selected
        </p>
        <p style={{ color: '#71717a', fontSize: 12, margin: 0, lineHeight: 1.6 }}>
          Select a profile or create one<br />to tunnel into IBM Cloud VPC
        </p>
      </div>
      <button onClick={onNew} style={{
        background: '#7C6FE0', color: '#fff', border: 'none', borderRadius: 8,
        padding: '7px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(124,111,224,0.3)',
        marginTop: 4, letterSpacing: '-0.01em',
      }}
        onMouseEnter={e => (e.currentTarget.style.background = '#5B52C4')}
        onMouseLeave={e => (e.currentTarget.style.background = '#7C6FE0')}
      >
        New Profile
      </button>
    </div>
  )
}
