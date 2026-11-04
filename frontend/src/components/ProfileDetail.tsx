import { useState, useEffect, useRef } from 'react'
import {
  Profile,
  TunnelState,
  TunnelStatus,
  SERVICE_PRESETS,
  LogEntry,
  ServiceType,
} from '@/types'
import { StatusBadge } from './StatusBadge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  Server,
  Key,
  User,
  ArrowRight,
  Clock,
  AlertCircle,
  Terminal,
  Pencil,
  Trash2,
  Copy,
  Check,
  CopyPlus,
  Zap,
  Power,
  RotateCw,
  ShieldCheck,
  Cpu,
  Layers,
  ArrowDownToLine,
} from 'lucide-react'

interface Props {
  profile: Profile
  state: TunnelState
  onConnect: () => void
  onDisconnect: () => void
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
}

function formatUptime(startedAt: string | null): string {
  if (!startedAt) return '—'
  const diff = Date.now() - new Date(startedAt).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export function ProfileDetail({
  profile,
  state,
  onConnect,
  onDisconnect,
  onEdit,
  onDelete,
  onDuplicate,
}: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'logs'>('overview')
  const [, setTick] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [copiedError, setCopiedError] = useState(false)

  const isConnected = state.status === TunnelStatus.StatusConnected
  const isConnecting = state.status === TunnelStatus.StatusConnecting
  const isError = state.status === TunnelStatus.StatusError
  const isActive = isConnected || isConnecting || isError

  // Tick every second when active (for uptime display)
  useEffect(() => {
    if (!isActive) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [isActive])

  // Reset delete confirmation when profile changes
  useEffect(() => {
    setConfirmDelete(false)
  }, [profile.id])

  const copyError = () => {
    if (!state.error) return
    navigator.clipboard.writeText(state.error)
    setCopiedError(true)
    setTimeout(() => setCopiedError(false), 1500)
  }

  return (
    <div className="flex flex-col h-full bg-zinc-50/60 overflow-hidden select-none">
      {/* Top Header */}
      <header className="px-8 pt-6 pb-5 bg-white border-b border-zinc-200/90 shadow-2xs">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div
              className={cn(
                'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-300 shadow-xs',
                isConnected
                  ? 'bg-emerald-50 border border-emerald-300 text-emerald-600 shadow-emerald-500/10'
                  : isConnecting
                  ? 'bg-amber-50 border border-amber-300 text-amber-600 animate-pulse'
                  : isError
                  ? 'bg-rose-50 border border-rose-300 text-rose-600'
                  : 'bg-zinc-100 border border-zinc-200 text-zinc-500'
              )}
            >
              <Server className="w-6 h-6" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-zinc-900 tracking-tight truncate">
                  {profile.name}
                </h1>
                <StatusBadge status={state.status} variant="badge" size="sm" />
              </div>
              <p className="text-xs text-zinc-500 mt-1 truncate">
                {profile.description || `Bastion: ${profile.user}@${profile.host}:${profile.port}`}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onDuplicate}
              title="Duplicate profile"
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 border border-zinc-200/80 transition-colors cursor-pointer"
            >
              <CopyPlus className="w-4 h-4" />
            </button>
            <button
              onClick={onEdit}
              title="Edit profile"
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 border border-zinc-200/80 transition-colors cursor-pointer"
            >
              <Pencil className="w-4 h-4" />
            </button>

            {confirmDelete ? (
              <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-lg p-1">
                <button
                  onClick={onDelete}
                  className="px-2.5 py-1 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded cursor-pointer transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-1 text-xs text-zinc-600 hover:text-zinc-900 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                title="Delete profile"
                className="p-2 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 border border-zinc-200/80 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <div className="h-6 w-px bg-zinc-200 mx-1" />

            {/* Connect / Disconnect Hero Button */}
            {isConnected ? (
              <button
                onClick={onDisconnect}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 shadow-xs cursor-pointer transition-all duration-150 active:scale-98"
              >
                <Power className="w-3.5 h-3.5 text-rose-600" />
                <span>Disconnect</span>
              </button>
            ) : isConnecting ? (
              <button
                onClick={onDisconnect}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-amber-200 shadow-xs cursor-pointer transition-all duration-150 active:scale-98 group"
                title="Click to cancel connecting"
              >
                <RotateCw className="w-3.5 h-3.5 text-amber-600 animate-spin group-hover:hidden" />
                <Power className="w-3.5 h-3.5 text-rose-600 hidden group-hover:inline" />
                <span className="group-hover:hidden">Connecting…</span>
                <span className="hidden group-hover:inline">Cancel</span>
              </button>
            ) : isError ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={onConnect}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm shadow-indigo-600/30 cursor-pointer transition-all duration-150 active:scale-98"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
                <button
                  onClick={onDisconnect}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-600 hover:text-rose-600 hover:bg-rose-50 border border-zinc-200 shadow-2xs cursor-pointer transition-all duration-150"
                  title="Stop retrying and close tunnel"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>Stop Tunnel</span>
                </button>
              </div>
            ) : (
              <button
                onClick={onConnect}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm shadow-indigo-600/30 cursor-pointer transition-all duration-150 active:scale-98"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Connect</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Metrics Strip */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-zinc-100 text-xs text-zinc-500">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400 font-medium">Status:</span>
            <span
              className={cn(
                'font-semibold',
                isConnected
                  ? 'text-emerald-600'
                  : isConnecting
                  ? 'text-amber-600'
                  : isError
                  ? 'text-rose-600'
                  : 'text-zinc-500'
              )}
            >
              {isConnected ? 'Active Tunnel' : isConnecting ? 'Establishing Connection' : isError ? 'Connection Error' : 'Disconnected'}
            </span>
          </div>

          {(isConnected || isConnecting) && state.startedAt && (
            <div className="flex items-center gap-1.5 border-l border-zinc-200 pl-4">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              <span className="font-mono text-zinc-600">{formatUptime(state.startedAt)}</span>
            </div>
          )}

          {isConnected && state.pid > 0 && (
            <div className="flex items-center gap-1.5 border-l border-zinc-200 pl-4">
              <Cpu className="w-3.5 h-3.5 text-zinc-400" />
              <span className="font-mono text-zinc-600">PID {state.pid}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 border-l border-zinc-200 pl-4">
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <span>
              {profile.forwards?.length ?? 0} {profile.forwards?.length === 1 ? 'Forward' : 'Forwards'}
            </span>
          </div>
        </div>

        {/* Error Alert Box */}
        {isError && state.error && (
          <div className="mt-3 flex items-start justify-between gap-3 bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800">
            <div className="flex items-start gap-2.5 min-w-0">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="min-w-0 font-mono text-rose-900 wrap-break-words leading-relaxed">
                {state.error}
              </div>
            </div>
            <button
              onClick={copyError}
              className="flex items-center gap-1 px-2 py-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-700 text-[11px] font-medium shrink-0 transition-colors cursor-pointer"
            >
              {copiedError ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copiedError ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        )}
      </header>

      {/* Navigation Tabs */}
      <div className="px-8 bg-white border-b border-zinc-200/90 flex items-center justify-between">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              'py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2',
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            )}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Overview &amp; Rules</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={cn(
              'py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2',
              activeTab === 'logs'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            )}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Terminal Logs</span>
            {(state.logs?.length ?? 0) > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-zinc-100 text-zinc-600 border border-zinc-200">
                {state.logs!.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-8 py-6">
        {activeTab === 'overview' ? (
          <OverviewTab
            profile={profile}
            isConnected={isConnected}
            portHealth={state.portHealth ?? {}}
          />
        ) : (
          <LogViewer logs={state.logs ?? []} />
        )}
      </main>
    </div>
  )
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      title={label || 'Copy to clipboard'}
      className="inline-flex items-center gap-1 p-1 rounded hover:bg-zinc-200/70 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

function OverviewTab({
  profile,
  isConnected,
  portHealth,
}: {
  profile: Profile
  isConnected: boolean
  portHealth: Record<string, boolean | undefined>
}) {
  const sshCommand = `ssh -i "${profile.keyPath}" -p ${profile.port} ${profile.user}@${profile.host}`

  return (
    <div className="w-full space-y-6">
      {/* Bastion Host Card */}
      <section className="bg-white rounded-2xl border border-zinc-200/90 shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 bg-zinc-50/60 border-b border-zinc-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-700 tracking-wide uppercase">
            Bastion Host Details
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-400 font-mono">SSH v2</span>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-50/80 rounded-xl p-3 border border-zinc-100">
            <div className="flex items-center justify-between text-zinc-400 mb-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider">Host &amp; Port</span>
              <CopyButton text={`${profile.host}:${profile.port}`} />
            </div>
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-zinc-500" />
              <span className="text-xs font-semibold font-mono text-zinc-800 truncate">
                {profile.host || '—'}:{profile.port}
              </span>
            </div>
          </div>

          <div className="bg-zinc-50/80 rounded-xl p-3 border border-zinc-100">
            <div className="flex items-center justify-between text-zinc-400 mb-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider">SSH User</span>
              <CopyButton text={profile.user} />
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-zinc-500" />
              <span className="text-xs font-semibold font-mono text-zinc-800 truncate">
                {profile.user || '—'}
              </span>
            </div>
          </div>

          <div className="bg-zinc-50/80 rounded-xl p-3 border border-zinc-100">
            <div className="flex items-center justify-between text-zinc-400 mb-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider">Private Key</span>
              <CopyButton text={profile.keyPath} />
            </div>
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-zinc-500" />
              <span className="text-xs font-semibold font-mono text-zinc-800 truncate" title={profile.keyPath}>
                {profile.keyPath || '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Copy full command bar */}
        <div className="px-5 py-2.5 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0 text-zinc-400">
            <Terminal className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="text-[11px] text-zinc-400 font-mono">SSH CLI:</span>
            <code className="text-[11px] font-mono text-zinc-300 truncate">{sshCommand}</code>
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(sshCommand)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium transition-colors cursor-pointer shrink-0"
          >
            <Copy className="w-3 h-3" />
            <span>Copy Command</span>
          </button>
        </div>
      </section>

      {/* Port Forward Rules */}
      <section className="bg-white rounded-2xl border border-zinc-200/90 shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 bg-zinc-50/60 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-700 tracking-wide uppercase">
              Port Forwarding Rules
            </span>
            <span className="text-[10px] font-mono bg-zinc-200 text-zinc-700 px-1.5 py-0.5 rounded font-semibold">
              {profile.forwards?.length ?? 0}
            </span>
          </div>
          {isConnected && (
            <span className="text-[11px] text-zinc-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              Auto-checking ports every 30s
            </span>
          )}
        </div>

        <div className="p-5">
          {(profile.forwards?.length ?? 0) === 0 ? (
            <div className="text-center py-8 text-zinc-400 text-xs">
              No port forward rules configured for this profile yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {(profile.forwards ?? []).map(fwd => {
                const preset = SERVICE_PRESETS[fwd.service]
                const key = String(fwd.localPort)
                const isKnown = isConnected && portHealth[key] !== undefined
                const isHealthy = isConnected && portHealth[key] === true

                return (
                  <div
                    key={fwd.id}
                    className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-zinc-200/80 bg-zinc-50/50 hover:bg-zinc-50 hover:border-zinc-300 transition-all duration-150"
                  >
                    {/* Service and Label */}
                    <div className="flex items-center gap-3 min-w-42.5 shrink-0">
                      <span
                        className={cn(
                          'text-[10px] font-semibold px-2.5 py-1 rounded-full border shrink-0',
                          preset?.color ?? 'bg-zinc-100 text-zinc-600 border-zinc-200'
                        )}
                      >
                        {preset?.label ?? 'Custom'}
                      </span>
                      {fwd.label && (
                        <span className="text-xs font-semibold text-zinc-800 truncate max-w-35">
                          {fwd.label}
                        </span>
                      )}
                    </div>

                    {/* Routing Map */}
                    <div className="flex-1 flex items-center gap-3 font-mono text-xs text-zinc-600 min-w-0">
                      <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-zinc-200 shadow-2xs shrink-0">
                        <span className="text-zinc-400 font-sans text-[11px]">Local:</span>
                        <span className="font-semibold text-zinc-900">127.0.0.1:{fwd.localPort}</span>
                        <CopyButton text={`127.0.0.1:${fwd.localPort}`} label="Copy local endpoint" />
                      </div>

                      <ArrowRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />

                      <div className="flex-1 min-w-0 flex items-center justify-between gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-zinc-200 shadow-2xs">
                        <div className="flex items-center gap-1.5 min-w-0 truncate">
                          <span className="text-zinc-400 font-sans text-[11px] shrink-0">Remote:</span>
                          <span className="text-zinc-800 font-medium truncate" title={`${fwd.remoteHost}:${fwd.remotePort}`}>
                            {fwd.remoteHost}:{fwd.remotePort}
                          </span>
                        </div>
                        <CopyButton text={`${fwd.remoteHost}:${fwd.remotePort}`} label="Copy remote endpoint" />
                      </div>
                    </div>

                    {/* Health Status Indicator */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isConnected ? (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border',
                            !isKnown
                              ? 'bg-zinc-100 text-zinc-500 border-zinc-200'
                              : isHealthy
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          )}
                        >
                          <span
                            className={cn(
                              'w-2 h-2 rounded-full',
                              !isKnown
                                ? 'bg-zinc-400'
                                : isHealthy
                                ? 'bg-emerald-500 animate-pulse'
                                : 'bg-rose-500'
                            )}
                          />
                          <span>
                            {!isKnown ? 'Pinging…' : isHealthy ? 'Healthy' : 'Unreachable'}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-zinc-400 font-medium">Inactive</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Quick Connect Snippets */}
      {(profile.forwards?.length ?? 0) > 0 && (
        <section className="bg-white rounded-2xl border border-zinc-200/90 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-zinc-50/60 border-b border-zinc-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-700 tracking-wide uppercase">
              Quick Connect Helpers
            </span>
            <span className="text-[11px] text-zinc-400">Ready-to-run client commands</span>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {(profile.forwards ?? []).map(fwd => {
              const hint = connectHint(fwd.service, fwd.localPort)
              const preset = SERVICE_PRESETS[fwd.service]
              return (
                <div
                  key={fwd.id}
                  className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 flex flex-col justify-between gap-2 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-indigo-300">
                      {fwd.label || preset?.label || 'Custom Port'} ({fwd.localPort})
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(hint)}
                      title="Copy connection command"
                      className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <code className="text-xs font-mono text-zinc-200 bg-zinc-950/70 rounded px-2.5 py-1.5 overflow-x-auto">
                    {hint}
                  </code>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

function connectHint(service: string, localPort: number): string {
  switch (service) {
    case ServiceType.ServicePostgres:
    case 'postgres':
      return `psql -h 127.0.0.1 -p ${localPort} -U <user> <dbname>`
    case ServiceType.ServiceRedis:
    case 'redis':
    case ServiceType.ServiceValkey:
    case 'valkey':
      return `redis-cli -h 127.0.0.1 -p ${localPort}`
    case ServiceType.ServiceElasticsearch:
    case 'elasticsearch':
      return `curl http://127.0.0.1:${localPort}`
    case ServiceType.ServiceEventStreams:
    case 'eventstreams':
      return `127.0.0.1:${localPort} (Kafka bootstrap server)`
    default:
      return `nc -zv 127.0.0.1 ${localPort}`
  }
}

function LogViewer({ logs }: { logs: LogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs.length, autoScroll])

  const copyAll = () => {
    const text = logs
      .map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.level.toUpperCase()}] ${l.line}`)
      .join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (logs.length === 0) {
    return (
      <div className="h-full min-h-75 flex flex-col items-center justify-center text-center p-8 bg-zinc-900 rounded-2xl border border-zinc-800 text-zinc-400">
        <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-500 mb-3">
          <Terminal className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-zinc-300">No logs generated yet</p>
        <p className="text-xs text-zinc-500 mt-1 max-w-sm">
          Connect to start streaming SSH subprocess stderr, connection handshakes, and diagnostic logs.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 rounded-2xl border border-zinc-800 shadow-xl overflow-hidden font-mono text-xs">
      {/* Terminal Titlebar */}
      <div className="px-4 py-2.5 bg-zinc-900/90 border-b border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-rose-500/80" />
          <span className="w-3 h-3 rounded-full bg-amber-500/80" />
          <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
          <span className="text-xs text-zinc-400 ml-2 font-medium">ssh-stderr.log</span>
          <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
            {logs.length} lines
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={cn(
              'px-2 py-1 rounded text-[11px] font-sans flex items-center gap-1 transition-colors cursor-pointer',
              autoScroll
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            )}
          >
            <ArrowDownToLine className="w-3 h-3" />
            <span>Auto-scroll</span>
          </button>
          <button
            onClick={copyAll}
            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-sans flex items-center gap-1 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy All'}</span>
          </button>
        </div>
      </div>

      {/* Terminal Output */}
      <ScrollArea className="flex-1 p-4 overflow-y-auto space-y-1">
        {logs.map((entry, i) => {
          const isErr = entry.level === 'error'
          const isWarn = entry.level === 'warn'
          return (
            <div
              key={i}
              className={cn(
                'flex items-start gap-3 py-0.5 leading-relaxed',
                isErr ? 'text-rose-400' : isWarn ? 'text-amber-400' : 'text-zinc-300'
              )}
            >
              <span className="text-zinc-600 select-none shrink-0 text-[11px]">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={cn(
                  'text-[10px] font-semibold px-1 rounded uppercase select-none shrink-0',
                  isErr
                    ? 'bg-rose-950 text-rose-300 border border-rose-800/50'
                    : isWarn
                    ? 'bg-amber-950 text-amber-300 border border-amber-800/50'
                    : 'bg-zinc-800 text-zinc-400'
                )}
              >
                {entry.level}
              </span>
              <span className="break-all whitespace-pre-wrap">{entry.line}</span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </ScrollArea>
    </div>
  )
}
