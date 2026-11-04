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
    <div className="flex flex-col h-full bg-zinc-50/70 select-none overflow-hidden">
      {/* Header */}
      <header className="px-8 py-5 bg-white border-b border-zinc-200/90 flex items-center justify-between shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 tracking-tight">
            {isNew ? 'Create New Profile' : 'Edit Profile'}
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Configure bastion SSH credentials and remote port forwarding targets
          </p>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="w-full max-w-5xl space-y-6">
          {/* Section: General & Bastion Info */}
          <section className="bg-white rounded-2xl border border-zinc-200/90 shadow-2xs overflow-hidden">
            <div className="px-6 py-4 bg-zinc-50/60 border-b border-zinc-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-700">
                Bastion Host Configuration
              </h3>
            </div>

            <div className="p-6 space-y-4">
              {/* Profile Name & Description */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Profile Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    placeholder="e.g. Production Environment"
                    className={cn(
                      'w-full px-3 py-2 text-xs rounded-xl border bg-white text-zinc-900 placeholder:text-zinc-400 outline-none transition-all shadow-2xs',
                      errors.name
                        ? 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-zinc-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                    )}
                  />
                  {errors.name && (
                    <p className="text-[11px] text-rose-500 mt-1">{errors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Description <span className="text-zinc-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={e => set('description', e.target.value)}
                    placeholder="e.g. Frankfurt region analytics DB"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-2xs"
                  />
                </div>
              </div>

              {/* Host & Port */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Bastion Host / IP <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.host}
                    onChange={e => set('host', e.target.value)}
                    placeholder="e.g. 169.48.12.34 or bastion.example.com"
                    className={cn(
                      'w-full px-3 py-2 text-xs font-mono rounded-xl border bg-white text-zinc-900 placeholder:text-zinc-400 outline-none transition-all shadow-2xs',
                      errors.host
                        ? 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-zinc-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                    )}
                  />
                  {errors.host && (
                    <p className="text-[11px] text-rose-500 mt-1">{errors.host}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    SSH Port
                  </label>
                  <input
                    type="number"
                    value={form.port}
                    onChange={e => set('port', parseInt(e.target.value) || 22)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-zinc-200 bg-white text-zinc-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-2xs"
                  />
                </div>
              </div>

              {/* User & Key Path */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    SSH Username <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.user}
                    onChange={e => set('user', e.target.value)}
                    placeholder="e.g. ubuntu, ec2-user, root"
                    className={cn(
                      'w-full px-3 py-2 text-xs font-mono rounded-xl border bg-white text-zinc-900 placeholder:text-zinc-400 outline-none transition-all shadow-2xs',
                      errors.user
                        ? 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-zinc-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                    )}
                  />
                  {errors.user && (
                    <p className="text-[11px] text-rose-500 mt-1">{errors.user}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Private Key Path
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.keyPath}
                      onChange={e => set('keyPath', e.target.value)}
                      placeholder="~/.ssh/id_rsa"
                      className="flex-1 px-3 py-2 text-xs font-mono rounded-xl border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-2xs truncate"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const path = await PickSSHKey()
                          if (path) set('keyPath', path)
                        } catch (_) {}
                      }}
                      title="Select key from disk"
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 transition-colors cursor-pointer shadow-2xs shrink-0"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Browse…</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Auto Connect Switch */}
              <div className="pt-2 border-t border-zinc-100">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    onClick={() => set('autoConnect', !form.autoConnect)}
                    className={cn(
                      'w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer',
                      form.autoConnect ? 'bg-indigo-600' : 'bg-zinc-300'
                    )}
                  >
                    <div
                      className={cn(
                        'bg-white w-4 h-4 rounded-full shadow-md transform transition-transform',
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
          <section className="bg-white rounded-2xl border border-zinc-200/90 shadow-2xs overflow-hidden">
            <div className="px-6 py-4 bg-zinc-50/60 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-700">
                  Port Forwarding Rules
                </h3>
                <span className="text-[10px] font-mono bg-zinc-200 text-zinc-700 px-1.5 py-0.5 rounded font-semibold">
                  {form.forwards?.length ?? 0}
                </span>
              </div>
              <button
                type="button"
                onClick={addForward}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/60 transition-colors cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Forward Rule</span>
              </button>
            </div>

            <div className="p-6">
              {(form.forwards ?? []).length === 0 ? (
                <div
                  onClick={addForward}
                  className="border-2 border-dashed border-zinc-200 hover:border-indigo-400 rounded-2xl p-8 text-center cursor-pointer transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 group-hover:bg-indigo-50 flex items-center justify-center mx-auto text-zinc-400 group-hover:text-indigo-600 transition-colors mb-2">
                    <Plus className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-zinc-700">No port forwarding rules</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
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
                        className="bg-zinc-50/60 rounded-xl border border-zinc-200/80 p-4 relative group"
                      >
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                                preset?.color ?? 'bg-zinc-100 text-zinc-600 border-zinc-200'
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
                            className="p-1 rounded text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                              Service Preset
                            </label>
                            <div className="relative">
                              <select
                                value={fwd.service}
                                onChange={e => onServiceChange(idx, e.target.value as ServiceType)}
                                className="w-full px-3 py-1.5 pr-8 text-xs rounded-lg border border-zinc-200 bg-white text-zinc-800 outline-none focus:border-indigo-500 appearance-none cursor-pointer"
                              >
                                {serviceOptions.map(opt => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                              Custom Label <span className="text-zinc-400">(optional)</span>
                            </label>
                            <input
                              type="text"
                              value={fwd.label}
                              onChange={e => updateForward(idx, { label: e.target.value })}
                              placeholder="e.g. Master DB"
                              className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white text-zinc-800 placeholder:text-zinc-400 outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>

                        {/* Port Mapping Row */}
                        <div className="grid grid-cols-1 md:grid-cols-7 gap-2.5 items-center">
                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                              Local Port
                            </label>
                            <input
                              type="number"
                              value={fwd.localPort || ''}
                              onChange={e =>
                                updateForward(idx, { localPort: parseInt(e.target.value) || 0 })
                              }
                              placeholder="5432"
                              className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-zinc-200 bg-white text-zinc-900 outline-none focus:border-indigo-500"
                            />
                          </div>

                          <div className="hidden md:flex justify-center pt-4">
                            <ArrowRight className="w-4 h-4 text-zinc-400" />
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                              Remote Target IP / Host
                            </label>
                            <input
                              type="text"
                              value={fwd.remoteHost}
                              onChange={e => updateForward(idx, { remoteHost: e.target.value })}
                              placeholder="10.0.0.5 or service.internal"
                              className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-zinc-200 bg-white text-zinc-900 outline-none focus:border-indigo-500"
                            />
                          </div>

                          <div className="md:col-span-1">
                            <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                              Remote Port
                            </label>
                            <input
                              type="number"
                              value={fwd.remotePort || ''}
                              onChange={e =>
                                updateForward(idx, { remotePort: parseInt(e.target.value) || 0 })
                              }
                              placeholder="5432"
                              className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-zinc-200 bg-white text-zinc-900 outline-none focus:border-indigo-500"
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
      <footer className="px-8 py-4 bg-white border-t border-zinc-200/90 flex items-center justify-end gap-3 shadow-sm">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl border border-zinc-200/80 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-sm shadow-indigo-600/30 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
        >
          {saving ? 'Saving Profile…' : isNew ? 'Create Profile' : 'Save Changes'}
        </button>
      </footer>
    </div>
  )
}
