import { useState } from 'react'
import { useAstra } from './useAstra'
import { ProfileList } from './components/ProfileList'
import { ProfileDetail } from './components/ProfileDetail'
import { ProfileForm } from './components/ProfileForm'
import { Profile } from './types'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Plus, Shield, RefreshCw, Activity } from 'lucide-react'

type View = 'detail' | 'form'

export default function App() {
  const {
    profiles,
    tunnelStates,
    selectedProfileId,
    selectedProfile,
    loading,
    setSelectedProfileId,
    getTunnelState,
    saveProfile,
    deleteProfile,
    duplicateProfile,
    connect,
    disconnect,
    disconnectAll,
  } = useAstra()

  const [view, setView] = useState<View>('detail')
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)

  function openNew() {
    setEditingProfile(null)
    setView('form')
  }

  function openEdit(p: Profile) {
    setEditingProfile(p)
    setView('form')
  }

  async function handleSave(p: Profile) {
    const saved = await saveProfile(p)
    setSelectedProfileId(saved.id)
    setView('detail')
  }

  async function handleDelete(id: string) {
    await deleteProfile(id)
    setView('detail')
  }

  function handleSelect(id: string) {
    setSelectedProfileId(id)
    setView('detail')
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-zinc-100 font-sans antialiased text-zinc-900 select-none">
        {/* Left Sidebar */}
        <ProfileList
          profiles={profiles}
          tunnelStates={tunnelStates}
          selectedId={selectedProfileId}
          onSelect={handleSelect}
          onNew={openNew}
          onDisconnectAll={disconnectAll}
        />

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-50 relative">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
              <p className="text-xs text-zinc-500 font-medium">Loading profiles…</p>
            </div>
          ) : view === 'form' ? (
            <ProfileForm
              profile={editingProfile}
              onSave={handleSave}
              onCancel={() => setView('detail')}
            />
          ) : selectedProfile ? (
            <ProfileDetail
              profile={selectedProfile}
              state={getTunnelState(selectedProfile.id)}
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

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-xl mx-auto">
      {/* Decorative Aura Box */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-3xl bg-linear-to-tr from-indigo-500/10 via-indigo-500/20 to-purple-500/20 border border-indigo-200/80 flex items-center justify-center shadow-md shadow-indigo-500/5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-600/40 text-white">
            <svg width="24" height="24" viewBox="0 0 11 13" fill="none">
              <path
                d="M7 0.5L1 7h4.5L4 12.5L10 6H5.5L7 0.5Z"
                fill="currentColor"
              />
            </svg>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
        No Profile Selected
      </h2>
      <p className="text-xs text-zinc-500 mt-2 leading-relaxed max-w-sm">
        Select an existing bastion profile from the sidebar, or create a new profile to forward remote &amp; service ports locally.
      </p>

      <div className="mt-5">
        <button
          onClick={onNew}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm shadow-indigo-600/30 transition-all cursor-pointer active:scale-98"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Profile</span>
        </button>
      </div>

      {/* Feature highlight cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-10 text-left w-full">
        <div className="bg-white p-3.5 rounded-xl border border-zinc-200/80 shadow-2xs">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2.5">
            <Shield className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-xs font-semibold text-zinc-800">Bastion Security</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5 leading-normal">
            SSH key auth with zero exposed private endpoints.
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-zinc-200/80 shadow-2xs">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2.5">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-xs font-semibold text-zinc-800">Health Probing</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5 leading-normal">
            Continuous 30s TCP dials confirm forwarded ports.
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-zinc-200/80 shadow-2xs">
          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-2.5">
            <RefreshCw className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-xs font-semibold text-zinc-800">Auto-Reconnect</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5 leading-normal">
            Automatic port freeing and exponential backoff.
          </p>
        </div>
      </div>
    </div>
  )
}
