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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [copiedError, setCopiedError] = useState(false)

  const confirmDelete = confirmDeleteId === profile.id

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

  const copyError = () => {
    if (!state.error) return
    navigator.clipboard.writeText(state.error)
    setCopiedError(true)
    setTimeout(() => setCopiedError(false), 1500)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-zinc-50/60 select-none">
      {/* Top Header */}
      <header className="border-b border-zinc-200/90 bg-white px-8 pt-6 pb-5 shadow-2xs">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div
              className={cn(
                'flex size-12 shrink-0 items-center justify-center rounded-2xl shadow-xs transition-all duration-300',
                isConnected
                  ? 'border border-emerald-300 bg-emerald-50 text-emerald-600 shadow-emerald-500/10'
                  : isConnecting
                  ? 'animate-pulse border border-amber-300 bg-amber-50 text-amber-600'
                  : isError
                  ? 'border border-rose-300 bg-rose-50 text-rose-600'
                  : 'border border-zinc-200 bg-zinc-100 text-zinc-500'
              )}
            >
              <Server className="size-6" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="truncate text-xl font-bold tracking-tight text-zinc-900">
                  {profile.name}
                </h1>
                <StatusBadge status={state.status} variant="badge" size="sm" />
              </div>
              <p className="mt-1 truncate text-xs text-zinc-500">
                {profile.description || `Bastion: ${profile.user}@${profile.host}:${profile.port}`}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onDuplicate}
              title="Duplicate profile"
              className="cursor-pointer rounded-lg border border-zinc-200/80 p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
            >
              <CopyPlus className="size-4" />
            </button>
            <button
              onClick={onEdit}
              title="Edit profile"
              className="cursor-pointer rounded-lg border border-zinc-200/80 p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
            >
              <Pencil className="size-4" />
            </button>

            {confirmDelete ? (
              <div className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 p-1">
                <button
                  onClick={onDelete}
                  className="cursor-pointer rounded bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-rose-700"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="cursor-pointer px-2 py-1 text-xs text-zinc-600 hover:text-zinc-900"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeleteId(profile.id)}
                title="Delete profile"
                className="cursor-pointer rounded-lg border border-zinc-200/80 p-2 text-zinc-400 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 className="size-4" />
              </button>
            )}

            <div className="mx-1 h-6 w-px bg-zinc-200" />

            {/* Connect / Disconnect Hero Button */}
            {isConnected ? (
              <button
                onClick={onDisconnect}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 shadow-xs transition-all duration-150 hover:bg-rose-100 active:scale-98"
              >
                <Power className="size-3.5 text-rose-600" />
                <span>Disconnect</span>
              </button>
            ) : isConnecting ? (
              <button
                onClick={onDisconnect}
                className="group inline-flex cursor-pointer items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700 shadow-xs transition-all duration-150 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 active:scale-98"
                title="Click to cancel connecting"
              >
                <RotateCw className="size-3.5 animate-spin text-amber-600 group-hover:hidden" />
                <Power className="hidden size-3.5 text-rose-600 group-hover:inline" />
                <span className="group-hover:hidden">Connecting…</span>
                <span className="hidden group-hover:inline">Cancel</span>
              </button>
            ) : isError ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={onConnect}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-600/30 transition-all duration-150 hover:bg-indigo-500 active:scale-98"
                >
                  <RotateCw className="size-3.5" />
                  <span>Retry</span>
                </button>
                <button
                  onClick={onDisconnect}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 shadow-2xs transition-all duration-150 hover:bg-rose-50 hover:text-rose-600"
                  title="Stop retrying and close tunnel"
                >
                  <Power className="size-3.5" />
                  <span>Stop Tunnel</span>
                </button>
              </div>
            ) : (
              <button
                onClick={onConnect}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-600/30 transition-all duration-150 hover:bg-indigo-500 active:scale-98"
              >
                <Zap className="size-3.5 fill-current" />
                <span>Connect</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Metrics Strip */}
        <div className="mt-4 flex items-center gap-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-zinc-400">Status:</span>
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
              <Clock className="size-3.5 text-zinc-400" />
              <span className="font-mono text-zinc-600">{formatUptime(state.startedAt)}</span>
            </div>
          )}

          {isConnected && state.pid > 0 && (
            <div className="flex items-center gap-1.5 border-l border-zinc-200 pl-4">
              <Cpu className="size-3.5 text-zinc-400" />
              <span className="font-mono text-zinc-600">PID {state.pid}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 border-l border-zinc-200 pl-4">
            <Layers className="size-3.5 text-zinc-400" />
            <span>
              {profile.forwards?.length ?? 0} {profile.forwards?.length === 1 ? 'Forward' : 'Forwards'}
            </span>
          </div>
        </div>

        {/* Error Alert Box */}
        {isError && state.error && (
          <div className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <div className="flex min-w-0 items-start gap-2.5">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-600" />
              <div className="min-w-0 font-mono leading-relaxed wrap-break-word text-rose-900">
                {state.error}
              </div>
            </div>
            <button
              onClick={copyError}
              className="flex shrink-0 cursor-pointer items-center gap-1 rounded bg-rose-100 px-2 py-1 text-[11px] font-medium text-rose-700 transition-colors hover:bg-rose-200"
            >
              {copiedError ? <Check className="size-3" /> : <Copy className="size-3" />}
              <span>{copiedError ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        )}
      </header>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-200/90 bg-white px-8">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              'flex cursor-pointer items-center gap-2 border-b-2 py-3 text-xs font-semibold transition-all',
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            )}
          >
            <ShieldCheck className="size-3.5" />
            <span>Overview &amp; Rules</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={cn(
              'flex cursor-pointer items-center gap-2 border-b-2 py-3 text-xs font-semibold transition-all',
              activeTab === 'logs'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            )}
          >
            <Terminal className="size-3.5" />
            <span>Terminal Logs</span>
            {(state.logs?.length ?? 0) > 0 && (
              <span className="rounded-full border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600">
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
      className="inline-flex cursor-pointer items-center gap-1 rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-200/70 hover:text-zinc-700"
    >
      {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
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
      <section className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xs">
        <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/60 px-5 py-3.5">
          <span className="text-xs font-semibold tracking-wide text-zinc-700 uppercase">
            Bastion Host Details
          </span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-zinc-400">SSH v2</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3">
            <div className="mb-1.5 flex items-center justify-between text-zinc-400">
              <span className="text-[11px] font-medium tracking-wider uppercase">Host &amp; Port</span>
              <CopyButton text={`${profile.host}:${profile.port}`} />
            </div>
            <div className="flex items-center gap-2">
              <Server className="size-4 text-zinc-500" />
              <span className="truncate font-mono text-xs font-semibold text-zinc-800">
                {profile.host || '—'}:{profile.port}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3">
            <div className="mb-1.5 flex items-center justify-between text-zinc-400">
              <span className="text-[11px] font-medium tracking-wider uppercase">SSH User</span>
              <CopyButton text={profile.user} />
            </div>
            <div className="flex items-center gap-2">
              <User className="size-4 text-zinc-500" />
              <span className="truncate font-mono text-xs font-semibold text-zinc-800">
                {profile.user || '—'}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3">
            <div className="mb-1.5 flex items-center justify-between text-zinc-400">
              <span className="text-[11px] font-medium tracking-wider uppercase">Private Key</span>
              <CopyButton text={profile.keyPath} />
            </div>
            <div className="flex items-center gap-2">
              <Key className="size-4 text-zinc-500" />
              <span className="truncate font-mono text-xs font-semibold text-zinc-800" title={profile.keyPath}>
                {profile.keyPath || '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Copy full command bar */}
        <div className="flex items-center justify-between gap-3 border-t border-zinc-800 bg-zinc-900 px-5 py-2.5 text-xs">
          <div className="flex min-w-0 items-center gap-2 text-zinc-400">
            <Terminal className="size-3.5 shrink-0 text-indigo-400" />
            <span className="font-mono text-[11px] text-zinc-400">SSH CLI:</span>
            <code className="truncate font-mono text-[11px] text-zinc-300">{sshCommand}</code>
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(sshCommand)}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
          >
            <Copy className="size-3" />
            <span>Copy Command</span>
          </button>
        </div>
      </section>

      {/* Port Forward Rules */}
      <section className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xs">
        <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/60 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wide text-zinc-700 uppercase">
              Port Forwarding Rules
            </span>
            <span className="rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-700">
              {profile.forwards?.length ?? 0}
            </span>
          </div>
          {isConnected && (
            <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <span className="inline-block size-2 rounded-full bg-emerald-500" />
              Auto-checking ports every 30s
            </span>
          )}
        </div>

        <div className="p-5">
          {(profile.forwards?.length ?? 0) === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-400">
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
                    className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5 transition-all duration-150 hover:border-zinc-300 hover:bg-zinc-50"
                  >
                    {/* Service and Label */}
                    <div className="flex min-w-42.5 shrink-0 items-center gap-3">
                      <span
                        className={cn(
                          'shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold',
                          preset?.color ?? 'border-zinc-200 bg-zinc-100 text-zinc-600'
                        )}
                      >
                        {preset?.label ?? 'Custom'}
                      </span>
                      {fwd.label && (
                        <span className="max-w-35 truncate text-xs font-semibold text-zinc-800">
                          {fwd.label}
                        </span>
                      )}
                    </div>

                    {/* Routing Map */}
                    <div className="flex min-w-0 flex-1 items-center gap-3 font-mono text-xs text-zinc-600">
                      <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 shadow-2xs">
                        <span className="font-sans text-[11px] text-zinc-400">Local:</span>
                        <span className="font-semibold text-zinc-900">127.0.0.1:{fwd.localPort}</span>
                        <CopyButton text={`127.0.0.1:${fwd.localPort}`} label="Copy local endpoint" />
                      </div>

                      <ArrowRight className="size-3.5 shrink-0 text-zinc-400" />

                      <div className="flex min-w-0 flex-1 items-center justify-between gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 shadow-2xs">
                        <div className="flex min-w-0 items-center gap-1.5 truncate">
                          <span className="shrink-0 font-sans text-[11px] text-zinc-400">Remote:</span>
                          <span className="truncate font-medium text-zinc-800" title={`${fwd.remoteHost}:${fwd.remotePort}`}>
                            {fwd.remoteHost}:{fwd.remotePort}
                          </span>
                        </div>
                        <CopyButton text={`${fwd.remoteHost}:${fwd.remotePort}`} label="Copy remote endpoint" />
                      </div>
                    </div>

                    {/* Health Status Indicator */}
                    <div className="flex shrink-0 items-center gap-2">
                      {isConnected ? (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
                            !isKnown
                              ? 'border-zinc-200 bg-zinc-100 text-zinc-500'
                              : isHealthy
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-rose-200 bg-rose-50 text-rose-700'
                          )}
                        >
                          <span
                            className={cn(
                              'size-2 rounded-full',
                              !isKnown
                                ? 'bg-zinc-400'
                                : isHealthy
                                ? 'animate-pulse bg-emerald-500'
                                : 'bg-rose-500'
                            )}
                          />
                          <span>
                            {!isKnown ? 'Pinging…' : isHealthy ? 'Healthy' : 'Unreachable'}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-zinc-400">Inactive</span>
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
        <section className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xs">
          <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/60 px-5 py-3.5">
            <span className="text-xs font-semibold tracking-wide text-zinc-700 uppercase">
              Quick Connect Helpers
            </span>
            <span className="text-[11px] text-zinc-400">Ready-to-run client commands</span>
          </div>

          <div className="grid grid-cols-1 gap-3.5 p-5 md:grid-cols-2 xl:grid-cols-3">
            {(profile.forwards ?? []).map(fwd => {
              const hint = connectHint(fwd.service, fwd.localPort)
              const preset = SERVICE_PRESETS[fwd.service]
              return (
                <div
                  key={fwd.id}
                  className="flex flex-col justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-indigo-300">
                      {fwd.label || preset?.label || 'Custom Port'} ({fwd.localPort})
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(hint)}
                      title="Copy connection command"
                      className="cursor-pointer rounded bg-zinc-800 p-1 text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
                    >
                      <Copy className="size-3" />
                    </button>
                  </div>
                  <code className="overflow-x-auto rounded bg-zinc-950/70 px-2.5 py-1.5 font-mono text-xs text-zinc-200">
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
      <div className="flex h-full min-h-75 flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
        <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-zinc-800 text-zinc-500">
          <Terminal className="size-6" />
        </div>
        <p className="text-sm font-semibold text-zinc-300">No logs generated yet</p>
        <p className="mt-1 max-w-sm text-xs text-zinc-500">
          Connect to start streaming SSH subprocess stderr, connection handshakes, and diagnostic logs.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 font-mono text-xs shadow-xl">
      {/* Terminal Titlebar */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/90 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-rose-500/80" />
          <span className="size-3 rounded-full bg-amber-500/80" />
          <span className="size-3 rounded-full bg-emerald-500/80" />
          <span className="ml-2 text-xs font-medium text-zinc-400">ssh-stderr.log</span>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
            {logs.length} lines
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={cn(
              'flex cursor-pointer items-center gap-1 rounded px-2 py-1 font-sans text-[11px] transition-colors',
              autoScroll
                ? 'border border-indigo-500/40 bg-indigo-600/30 text-indigo-300'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            )}
          >
            <ArrowDownToLine className="size-3" />
            <span>Auto-scroll</span>
          </button>
          <button
            onClick={copyAll}
            className="flex cursor-pointer items-center gap-1 rounded bg-zinc-800 px-2 py-1 font-sans text-[11px] text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
            <span>{copied ? 'Copied' : 'Copy All'}</span>
          </button>
        </div>
      </div>

      {/* Terminal Output */}
      <ScrollArea className="flex-1 space-y-1 overflow-y-auto p-4">
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
              <span className="shrink-0 text-[11px] text-zinc-600 select-none">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={cn(
                  'shrink-0 rounded px-1 text-[10px] font-semibold uppercase select-none',
                  isErr
                    ? 'border border-rose-800/50 bg-rose-950 text-rose-300'
                    : isWarn
                    ? 'border border-amber-800/50 bg-amber-950 text-amber-300'
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
