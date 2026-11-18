import { useState } from 'react'
import { useAstra } from './useAstra'
import { useUpdater } from './useUpdater'
import { ProfileList } from './components/ProfileList'
import { ProfileDetail } from './components/ProfileDetail'
import { ProfileForm } from './components/ProfileForm'
import { UpdateModal } from './components/UpdateModal'
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

  const updater = useUpdater()
  const [view, setView] = useState<View>('detail')
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [updateModalOpen, setUpdateModalOpen] = useState(false)

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
      <div className="flex h-screen w-screen overflow-hidden bg-zinc-100 font-sans text-zinc-900 antialiased select-none">
        {/* Left Sidebar */}
        <ProfileList
          profiles={profiles}
          tunnelStates={tunnelStates}
          selectedId={selectedProfileId}
          onSelect={handleSelect}
          onNew={openNew}
          onDisconnectAll={disconnectAll}
          version={updater.versionInfo?.version}
          hasUpdate={updater.updateResult?.hasUpdate}
          readyToRestart={updater.readyToRestart}
          onOpenUpdate={() => {
            setUpdateModalOpen(true)
            if (!updater.updateResult && !updater.checking) {
              updater.checkForUpdate(false)
            }
          }}
        />

        {/* Right Content Area */}
        <div className="relative flex h-full flex-1 flex-col overflow-hidden bg-zinc-50">
          {loading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <div className="size-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
              <p className="text-xs font-medium text-zinc-500">Loading profiles…</p>
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

      <UpdateModal
        open={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
        versionInfo={updater.versionInfo}
        updateResult={updater.updateResult}
        checking={updater.checking}
        checkError={updater.checkError}
        progress={updater.progress}
        installing={updater.installing}
        readyToRestart={updater.readyToRestart}
        installError={updater.installError}
        onCheck={() => updater.checkForUpdate(false)}
        onInstall={updater.installUpdate}
        onRestart={updater.restartApp}
        onOpenReleasePage={() => updater.openReleasePage()}
      />
    </TooltipProvider>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center p-8 text-center">
      {/* Decorative Aura Box */}
      <div className="relative mb-6">
        <div className="flex size-20 items-center justify-center rounded-3xl border border-indigo-200/80 bg-linear-to-tr from-indigo-500/10 via-indigo-500/20 to-purple-500/20 shadow-md shadow-indigo-500/5">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/40">
            <svg width="24" height="24" viewBox="0 0 11 13" fill="none">
              <path
                d="M7 0.5L1 7h4.5L4 12.5L10 6H5.5L7 0.5Z"
                fill="currentColor"
              />
            </svg>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-bold tracking-tight text-zinc-900">
        No Profile Selected
      </h2>
      <p className="mt-2 max-w-sm text-xs leading-relaxed text-zinc-500">
        Select an existing bastion profile from the sidebar, or create a new profile to forward remote &amp; service ports locally.
      </p>

      <div className="mt-5">
        <button
          onClick={onNew}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm shadow-indigo-600/30 transition-all hover:bg-indigo-500 active:scale-98"
        >
          <Plus className="size-4" />
          <span>Create New Profile</span>
        </button>
      </div>

      {/* Feature highlight cards */}
      <div className="mt-10 grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-2xs">
          <div className="mb-2.5 flex size-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Shield className="size-3.5" />
          </div>
          <h3 className="text-xs font-semibold text-zinc-800">Bastion Security</h3>
          <p className="mt-0.5 text-[11px] leading-normal text-zinc-500">
            SSH key auth with zero exposed private endpoints.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-2xs">
          <div className="mb-2.5 flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <Activity className="size-3.5" />
          </div>
          <h3 className="text-xs font-semibold text-zinc-800">Health Probing</h3>
          <p className="mt-0.5 text-[11px] leading-normal text-zinc-500">
            Continuous 30s TCP dials confirm forwarded ports.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-2xs">
          <div className="mb-2.5 flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <RefreshCw className="size-3.5" />
          </div>
          <h3 className="text-xs font-semibold text-zinc-800">Auto-Reconnect</h3>
          <p className="mt-0.5 text-[11px] leading-normal text-zinc-500">
            Automatic port freeing and exponential backoff.
          </p>
        </div>
      </div>
    </div>
  )
}
