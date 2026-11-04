import { useState } from 'react'
import { Profile, PortForward, ServiceType, SERVICE_PRESETS, emptyProfile } from '@/types'
import { Plus, Trash2, X, ChevronDown, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PickSSHKey } from '../../bindings/github.com/pankajkumar/astra/astraservice'

interface Props {
  profile?: Profile | null
  onSave: (p: Profile) => Promise<void>
  onCancel: () => void
}

function newForward(): PortForward {
  return { id: '', label: '', service: ServiceType.ServicePostgres, localPort: 5432, remoteHost: '', remotePort: 5432 }
}

function LInput({ value, onChange, placeholder, mono, type = 'text', error }: {
  value: string | number; onChange: (v: string) => void; placeholder?: string
  mono?: boolean; type?: string; error?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoCapitalize="off"
      autoCorrect="off"
      autoComplete="off"
      spellCheck={false}
      style={{
        width: '100%', boxSizing: 'border-box',
        background: '#fff',
        border: `1px solid ${error ? '#fca5a5' : '#e4e4e7'}`,
        borderRadius: 7, padding: '7px 10px', fontSize: 12,
        color: '#18181b', caretColor: '#10b981', outline: 'none',
        fontFamily: mono ? '"SF Mono", ui-monospace, monospace' : 'inherit',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onFocus={e => {
        e.currentTarget.style.borderColor = error ? '#f87171' : '#10b981'
        e.currentTarget.style.boxShadow = `0 0 0 3px ${error ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.12)'}`
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = error ? '#fca5a5' : '#e4e4e7'
        e.currentTarget.style.boxShadow = 'none'
      }}
    />
  )
}

function LLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 11, fontWeight: 500, color: '#71717a', display: 'block', marginBottom: 5 }}>{children}</label>
}

function LSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        width: '100%', boxSizing: 'border-box',
        background: '#fff', border: '1px solid #e4e4e7',
        borderRadius: 7, padding: '7px 28px 7px 10px', fontSize: 12,
        color: '#18181b', outline: 'none', appearance: 'none', cursor: 'pointer',
      }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: '#a1a1aa', pointerEvents: 'none' }} />
    </div>
  )
}

export function ProfileForm({ profile, onSave, onCancel }: Props) {
  const [form, setForm] = useState<Profile>(profile ?? emptyProfile())
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const isNew = !form.id

  function set<K extends keyof Profile>(k: K, v: Profile[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
    setErrors(prev => { const e = { ...prev }; delete e[k as string]; return e })
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Required'
    if (!form.host.trim()) e.host = 'Required'
    if (!form.user.trim()) e.user = 'Required'
    setErrors(e); return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  function addForward() {
    setForm(prev => ({ ...prev, forwards: [...(prev.forwards ?? []), newForward()] }))
  }

  function removeForward(idx: number) {
    setForm(prev => ({ ...prev, forwards: (prev.forwards ?? []).filter((_, i) => i !== idx) }))
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f4f4f5', position: 'relative' }}>

      {/* Header — also serves as drag region for the title bar */}
      <div
       
        style={{
          padding: '52px 28px 16px', background: '#fff',
          borderBottom: '1px solid #e4e4e7',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          position: 'relative', zIndex: 2,
        }}
      >
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#18181b', margin: 0, letterSpacing: '-0.02em' }}>
            {isNew ? 'New Profile' : 'Edit Profile'}
          </h2>
          <p style={{ fontSize: 12, color: '#71717a', margin: '3px 0 0' }}>
            Configure your IBM Cloud VPC connection
          </p>
        </div>
        <button onClick={onCancel} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#a1a1aa', display: 'flex',
        }}
          onMouseEnter={e => (e.currentTarget.style.color = '#52525b')}
          onMouseLeave={e => (e.currentTarget.style.color = '#a1a1aa')}
        >
          <X style={{ width: 16, height: 16 }} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Connection */}
        <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 12, padding: '16px 18px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a1a1aa', margin: '0 0 14px' }}>
            Connection
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <LLabel>Profile Name {errors.name && <span style={{ color: '#ef4444', marginLeft: 4 }}>— {errors.name}</span>}</LLabel>
              <LInput value={form.name} onChange={v => set('name', v)} placeholder="e.g. Production VPC" error={!!errors.name} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <LLabel>Description <span style={{ color: '#d4d4d8' }}>(optional)</span></LLabel>
              <LInput value={form.description} onChange={v => set('description', v)} placeholder="What is this for?" />
            </div>
            <div style={{ height: 1, background: '#f4f4f5', gridColumn: '1 / -1', margin: '2px 0' }} />
            <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 80px', gap: 10 }}>
              <div>
                <LLabel>VSI Host {errors.host && <span style={{ color: '#ef4444', marginLeft: 4 }}>— {errors.host}</span>}</LLabel>
                <LInput value={form.host} onChange={v => set('host', v)} placeholder="169.x.x.x" mono error={!!errors.host} />
              </div>
              <div>
                <LLabel>SSH Port</LLabel>
                <LInput value={form.port} onChange={v => set('port', parseInt(v) || 22)} type="number" mono />
              </div>
            </div>
            <div>
              <LLabel>Username {errors.user && <span style={{ color: '#ef4444', marginLeft: 4 }}>— {errors.user}</span>}</LLabel>
              <LInput value={form.user} onChange={v => set('user', v)} placeholder="ubuntu" mono error={!!errors.user} />
            </div>
            <div>
              <LLabel>SSH Key Path</LLabel>
              <div style={{ display: 'flex', gap: 6 }}>
                <LInput value={form.keyPath} onChange={v => set('keyPath', v)} placeholder="~/.ssh/id_rsa" mono />
                <button
                  onClick={async () => {
                    try {
                      const path = await PickSSHKey()
                      if (path) set('keyPath', path)
                    } catch (_) {}
                  }}
                  title="Browse for key file"
                  style={{
                    flexShrink: 0, width: 32, height: 32, borderRadius: 7, cursor: 'pointer',
                    background: '#f4f4f5', border: '1px solid #e4e4e7',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#e4e4e7')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#f4f4f5')}
                >
                  <FolderOpen style={{ width: 14, height: 14, color: '#71717a' }} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Port Forwards */}
        <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a1a1aa', margin: 0 }}>
              Port Forwards
            </p>
            <button onClick={addForward} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '3px 8px',
              fontSize: 11, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, borderRadius: 5,
              fontWeight: 500,
            }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <Plus style={{ width: 11, height: 11 }} /> Add
            </button>
          </div>

          {(form.forwards ?? []).length === 0 ? (
            <div onClick={addForward} style={{
              border: '1px dashed #d4d4d8', borderRadius: 8,
              padding: '18px 16px', textAlign: 'center', cursor: 'pointer',
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#10b981')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#d4d4d8')}
            >
              <p style={{ fontSize: 12, color: '#a1a1aa', margin: 0 }}>No forwards yet — click to add one</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(form.forwards ?? []).map((fwd, i) => (
                <div key={i} style={{ background: '#f9f9f9', border: '1px solid #e4e4e7', borderRadius: 9, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium',
                      SERVICE_PRESETS[fwd.service]?.color ?? 'bg-zinc-100 text-zinc-500 border-zinc-200')}>
                      {SERVICE_PRESETS[fwd.service]?.label}
                    </span>
                    <button onClick={() => removeForward(i)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 3, borderRadius: 4, color: '#d4d4d8',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#d4d4d8')}
                    >
                      <Trash2 style={{ width: 13, height: 13 }} />
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <LLabel>Service</LLabel>
                      <LSelect value={fwd.service} onChange={v => onServiceChange(i, v as ServiceType)} options={serviceOptions} />
                    </div>
                    <div>
                      <LLabel>Label <span style={{ color: '#d4d4d8' }}>(optional)</span></LLabel>
                      <LInput value={fwd.label} onChange={v => updateForward(i, { label: v })} placeholder="Production DB" />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px', gap: 8 }}>
                    <div>
                      <LLabel>Local Port</LLabel>
                      <LInput value={fwd.localPort || ''} onChange={v => updateForward(i, { localPort: parseInt(v) || 0 })} type="number" mono />
                    </div>
                    <div>
                      <LLabel>Remote Host</LLabel>
                      <LInput value={fwd.remoteHost} onChange={v => updateForward(i, { remoteHost: v })} placeholder="10.0.0.5" mono />
                    </div>
                    <div>
                      <LLabel>Remote Port</LLabel>
                      <LInput value={fwd.remotePort || ''} onChange={v => updateForward(i, { remotePort: parseInt(v) || 0 })} type="number" mono />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '14px 28px', borderTop: '1px solid #e4e4e7', background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{
          background: 'none', border: '1px solid #e4e4e7', borderRadius: 7,
          padding: '6px 16px', fontSize: 12, color: '#71717a', cursor: 'pointer', fontWeight: 500,
        }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f4f4f5')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving} style={{
          background: '#10b981', color: '#fff', border: 'none',
          borderRadius: 7, padding: '6px 18px', fontSize: 12, fontWeight: 600,
          cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
          boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
        }}
          onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#059669' }}
          onMouseLeave={e => (e.currentTarget.style.background = '#10b981')}
        >
          {saving ? 'Saving…' : isNew ? 'Create Profile' : 'Save Changes'}
        </button>
        </div>
      </div>
    </div>
  )
}

import React from 'react'
