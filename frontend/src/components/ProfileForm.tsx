import { useState } from 'react'
import {
  Profile,
  PortForward,
  ServiceType,
  SERVICE_PRESETS,
  emptyProfile,
} from '@/types'
import { Plus, Trash2, X, ChevronDown, FolderOpen, ArrowRight, Shield, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PickSSHKey } from '../../bindings/github.com/pankajkumar/astra/astraservice'

interface Props {
  profile?: Profile | null
  onSave: (p: Profile) => Promise<void>
  onCancel: () => void
}

function newForward(): PortForward {
  return {
    id: `fwd-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    label: '',
    service: ServiceType.ServicePostgres,
    localPort: 5432,
    remoteHost: '',
    remotePort: 5432,
  }
}

export function ProfileForm({ profile, onSave, onCancel }: Props) {
  const [form, setForm] = useState<Profile>(profile ?? emptyProfile())
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const isNew = !form.id

  function set<K extends keyof Profile>(k: K, v: Profile[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
    setErrors(prev => {
      const e = { ...prev }
      delete e[k as string]
      return e
    })
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Profile name is required'
    if (!form.host.trim()) e.host = 'Bastion host is required'
    if (!form.user.trim()) e.user = 'SSH username is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    try {
      await onSave(form)
    } finally {
      setSaving(false)
    }
  }

  function addForward() {
    setForm(prev => ({
      ...prev,
      forwards: [...(prev.forwards ?? []), newForward()],
    }))
  }

  function removeForward(idx: number) {
    setForm(prev => ({
      ...prev,
      forwards: (prev.forwards ?? []).filter((_, i) => i !== idx),
    }))
  }

  function updateForward(idx: number, patch: Partial<PortForward>) {
    setForm(prev => {
      const fwds = [...(prev.forwards ?? [])]
      fwds[idx] = { ...fwds[idx], ...patch }
      return { ...prev, forwards: fwds }
    })
  }

  function onServiceChange(idx: number, svc: ServiceType) {
    const preset = SERVICE_PRESETS[svc]
    updateForward(idx, {
      service: svc,
      remotePort: svc !== ServiceType.ServiceCustom ? preset.port : 0,
      localPort: svc !== ServiceType.ServiceCustom ? preset.port : 0,
      label: svc !== ServiceType.ServiceCustom ? preset.label : '',
    })
  }

  const serviceOptions = Object.entries(SERVICE_PRESETS)
    .filter(([k]) => k !== ServiceType.$zero)
    .map(([k, v]) => ({ value: k, label: v.label }))

  return (
    <div className="flex h-full flex-col overflow-hidden bg-zinc-50/70 select-none">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-200/90 bg-white px-8 py-5 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-zinc-900">
            {isNew ? 'Create New Profile' : 'Edit Profile'}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Configure bastion SSH credentials and remote port forwarding targets
          </p>
        </div>
        <button
          onClick={onCancel}
          className="cursor-pointer rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
        >
          <X className="size-5" />
        </button>
      </header>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="w-full max-w-5xl space-y-6">
          {/* Section: General & Bastion Info */}
          <section className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xs">
            <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/60 px-6 py-4">
              <Shield className="size-4 text-indigo-600" />
              <h3 className="text-xs font-semibold tracking-wider text-zinc-700 uppercase">
                Bastion Host Configuration
              </h3>
            </div>

            <div className="space-y-4 p-6">
              {/* Profile Name & Description */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                    Profile Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    placeholder="e.g. Production Environment"
                    className={cn(
                      'w-full rounded-xl border bg-white px-3 py-2 text-xs text-zinc-900 shadow-2xs transition-all outline-none placeholder:text-zinc-400',
                      errors.name
                        ? 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-zinc-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                    )}
                  />
                  {errors.name && (
                    <p className="mt-1 text-[11px] text-rose-500">{errors.name}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                    Description <span className="font-normal text-zinc-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={e => set('description', e.target.value)}
                    placeholder="e.g. Frankfurt region analytics DB"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-2xs transition-all outline-none placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {/* Host & Port */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="md:col-span-3">
                  <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                    Bastion Host / IP <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.host}
                    onChange={e => set('host', e.target.value)}
                    placeholder="e.g. 169.48.12.34 or bastion.example.com"
                    className={cn(
                      'w-full rounded-xl border bg-white px-3 py-2 font-mono text-xs text-zinc-900 shadow-2xs transition-all outline-none placeholder:text-zinc-400',
                      errors.host
                        ? 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-zinc-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                    )}
                  />
                  {errors.host && (
                    <p className="mt-1 text-[11px] text-rose-500">{errors.host}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                    SSH Port
                  </label>
                  <input
                    type="number"
                    value={form.port}
                    onChange={e => set('port', parseInt(e.target.value) || 22)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-900 shadow-2xs transition-all outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {/* User & Key Path */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                    SSH Username <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.user}
                    onChange={e => set('user', e.target.value)}
                    placeholder="e.g. ubuntu, ec2-user, root"
                    className={cn(
                      'w-full rounded-xl border bg-white px-3 py-2 font-mono text-xs text-zinc-900 shadow-2xs transition-all outline-none placeholder:text-zinc-400',
                      errors.user
                        ? 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-zinc-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                    )}
                  />
                  {errors.user && (
                    <p className="mt-1 text-[11px] text-rose-500">{errors.user}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                    Private Key Path
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.keyPath}
                      onChange={e => set('keyPath', e.target.value)}
                      placeholder="~/.ssh/id_rsa"
                      className="flex-1 truncate rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-900 shadow-2xs transition-all outline-none placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const path = await PickSSHKey()
                          if (path) set('keyPath', path)
                        } catch {
                          // ignore cancelled dialog
                        }
                      }}
                      title="Select key from disk"
                      className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700 shadow-2xs transition-colors hover:bg-zinc-100"
                    >
                      <FolderOpen className="size-3.5 text-zinc-500" />
                      <span>Browse…</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Auto Connect Switch */}
              <div className="border-t border-zinc-100 pt-2">
                <label className="flex cursor-pointer items-center gap-3 select-none">
                  <div
                    onClick={() => set('autoConnect', !form.autoConnect)}
                    className={cn(
                      'flex h-5 w-9 cursor-pointer items-center rounded-full p-0.5 transition-colors',
                      form.autoConnect ? 'bg-indigo-600' : 'bg-zinc-300'
                    )}
                  >
                    <div
                      className={cn(
                        'size-4 transform rounded-full bg-white shadow-md transition-transform',
                        form.autoConnect ? 'translate-x-4' : 'translate-x-0'
                      )}
                    />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-zinc-800">
                      Auto-connect on Astra launch
                    </span>
                    <p className="text-[11px] text-zinc-400">
                      Automatically establishes this SSH tunnel when Astra starts up
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </section>

          {/* Section: Port Forwards */}
          <section className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xs">
            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/60 px-6 py-4">
              <div className="flex items-center gap-2">
                <Zap className="size-4 text-indigo-600" />
                <h3 className="text-xs font-semibold tracking-wider text-zinc-700 uppercase">
                  Port Forwarding Rules
                </h3>
                <span className="rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-700">
                  {form.forwards?.length ?? 0}
                </span>
              </div>
              <button
                type="button"
                onClick={addForward}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-indigo-200/60 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-2xs transition-colors hover:bg-indigo-100"
              >
                <Plus className="size-3.5" />
                <span>Add Forward Rule</span>
              </button>
            </div>

            <div className="p-6">
              {(form.forwards ?? []).length === 0 ? (
                <div
                  onClick={addForward}
                  className="group cursor-pointer rounded-2xl border-2 border-dashed border-zinc-200 p-8 text-center transition-colors hover:border-indigo-400"
                >
                  <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600">
                    <Plus className="size-5" />
                  </div>
                  <p className="text-xs font-semibold text-zinc-700">No port forwarding rules</p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    Click here to forward local ports (Postgres, Redis, remote services)
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(form.forwards ?? []).map((fwd, idx) => {
                    const preset = SERVICE_PRESETS[fwd.service]
                    return (
                      <div
                        key={fwd.id || idx}
                        className="group relative rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4"
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                                preset?.color ?? 'border-zinc-200 bg-zinc-100 text-zinc-600'
                              )}
                            >
                              Rule #{idx + 1}
                            </span>
                            <span className="text-xs font-semibold text-zinc-800">
                              {fwd.label || preset?.label || 'Port Forward'}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeForward(idx)}
                            title="Delete rule"
                            className="cursor-pointer rounded p-1 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>

                        <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-[11px] font-medium text-zinc-500">
                              Service Preset
                            </label>
                            <div className="relative">
                              <select
                                value={fwd.service}
                                onChange={e => onServiceChange(idx, e.target.value as ServiceType)}
                                className="w-full cursor-pointer appearance-none rounded-lg border border-zinc-200 bg-white px-3 py-1.5 pr-8 text-xs text-zinc-800 outline-none focus:border-indigo-500"
                              >
                                {serviceOptions.map(opt => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-zinc-400" />
                            </div>
                          </div>

                          <div>
                            <label className="mb-1 block text-[11px] font-medium text-zinc-500">
                              Custom Label <span className="text-zinc-400">(optional)</span>
                            </label>
                            <input
                              type="text"
                              value={fwd.label}
                              onChange={e => updateForward(idx, { label: e.target.value })}
                              placeholder="e.g. Master DB"
                              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-indigo-500"
                            />
                          </div>
                        </div>

                        {/* Port Mapping Row */}
                        <div className="grid grid-cols-1 items-center gap-2.5 md:grid-cols-7">
                          <div className="md:col-span-2">
                            <label className="mb-1 block font-mono text-[10px] text-zinc-400 uppercase">
                              Local Port
                            </label>
                            <input
                              type="number"
                              value={fwd.localPort || ''}
                              onChange={e =>
                                updateForward(idx, { localPort: parseInt(e.target.value) || 0 })
                              }
                              placeholder="5432"
                              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 font-mono text-xs text-zinc-900 outline-none focus:border-indigo-500"
                            />
                          </div>

                          <div className="hidden justify-center pt-4 md:flex">
                            <ArrowRight className="size-4 text-zinc-400" />
                          </div>

                          <div className="md:col-span-3">
                            <label className="mb-1 block font-mono text-[10px] text-zinc-400 uppercase">
                              Remote Target IP / Host
                            </label>
                            <input
                              type="text"
                              value={fwd.remoteHost}
                              onChange={e => updateForward(idx, { remoteHost: e.target.value })}
                              placeholder="10.0.0.5 or service.internal"
                              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 font-mono text-xs text-zinc-900 outline-none focus:border-indigo-500"
                            />
                          </div>

                          <div className="md:col-span-1">
                            <label className="mb-1 block font-mono text-[10px] text-zinc-400 uppercase">
                              Remote Port
                            </label>
                            <input
                              type="number"
                              value={fwd.remotePort || ''}
                              onChange={e =>
                                updateForward(idx, { remotePort: parseInt(e.target.value) || 0 })
                              }
                              placeholder="5432"
                              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 font-mono text-xs text-zinc-900 outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Sticky Bottom Actions Bar */}
      <footer className="flex items-center justify-end gap-3 border-t border-zinc-200/90 bg-white px-8 py-4 shadow-sm">
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-xl border border-zinc-200/80 px-4 py-2 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-600/30 transition-all hover:bg-indigo-500 active:scale-98 disabled:opacity-50"
        >
          {saving ? 'Saving Profile…' : isNew ? 'Create Profile' : 'Save Changes'}
        </button>
      </footer>
    </div>
  )
}
