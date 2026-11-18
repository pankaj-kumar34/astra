import {
  X,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  RotateCcw,
} from 'lucide-react'
import type { AppVersionInfo, UpdateCheckResult, UpdateProgress } from '@/useUpdater'

interface Props {
  open: boolean
  onClose: () => void
  versionInfo: AppVersionInfo | null
  updateResult: UpdateCheckResult | null
  checking: boolean
  checkError: string | null
  progress: UpdateProgress | null
  installing: boolean
  readyToRestart: boolean
  installError: string | null
  onCheck: () => void
  onInstall: () => void
  onRestart: () => void
  onOpenReleasePage: () => void
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let val = bytes
  let idx = 0
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024
    idx++
  }
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`
}

export function UpdateModal({
  open,
  onClose,
  versionInfo,
  updateResult,
  checking,
  checkError,
  progress,
  installing,
  readyToRestart,
  installError,
  onCheck,
  onInstall,
  onRestart,
  onOpenReleasePage,
}: Props) {
  if (!open) return null

  const currentVersion = updateResult?.currentVersion || versionInfo?.version || '1.0.0'
  const hasUpdate = Boolean(updateResult?.hasUpdate)
  const canSelfUpdate = Boolean(updateResult?.canSelfUpdate && updateResult?.assetUrl)
  const pct = Math.min(100, Math.max(0, Math.round(progress?.percent ?? 0)))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-xs"
      onClick={() => {
        if (!installing) onClose()
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Sparkles className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Software Update</h3>
              <p className="text-[11px] text-zinc-500">
                Current version: <span className="font-mono font-medium text-zinc-700">v{currentVersion}</span>
                {versionInfo?.os && versionInfo?.arch && (
                  <span className="ml-1.5 text-zinc-400">
                    ({versionInfo.os}/{versionInfo.arch})
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={installing}
            className="cursor-pointer rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-40"
            title="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-4">
          {checking && !updateResult && (
            <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
              <RefreshCw className="size-4 animate-spin text-indigo-600" />
              <span>Checking GitHub Releases for updates…</span>
            </div>
          )}

          {checkError && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs text-rose-700">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-600" />
              <div className="min-w-0 flex-1 break-words">{checkError}</div>
            </div>
          )}

          {installError && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs text-rose-700">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-600" />
              <div className="min-w-0 flex-1 break-words">{installError}</div>
            </div>
          )}

          {readyToRestart ? (
            <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <span>Update Installed</span>
              </div>
              <p className="text-xs leading-relaxed text-emerald-700">
                {progress?.message || 'Astra has been updated. Restart to launch the new version.'}
              </p>
            </div>
          ) : installing && progress ? (
            <div className="space-y-2.5 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
              <div className="flex items-center justify-between text-xs font-medium text-indigo-900">
                <span>{progress.message || 'Updating…'}</span>
                <span className="font-mono">{pct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-indigo-100">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all duration-150"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {progress.totalBytes > 0 && (
                <p className="text-right font-mono text-[10px] text-indigo-600/80">
                  {formatBytes(progress.downloadedBytes)} / {formatBytes(progress.totalBytes)}
                </p>
              )}
            </div>
          ) : updateResult ? (
            hasUpdate ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/60 px-3.5 py-3">
                  <div>
                    <p className="text-xs font-semibold text-indigo-950">
                      {updateResult.releaseName || `v${updateResult.latestVersion}`}
                    </p>
                    <p className="mt-0.5 text-[11px] text-indigo-700">
                      New version <span className="font-mono font-semibold">v{updateResult.latestVersion}</span> is available
                    </p>
                  </div>
                  {updateResult.assetSize > 0 && (
                    <span className="rounded-md bg-white/80 px-2 py-0.5 font-mono text-[10px] text-indigo-700">
                      {formatBytes(updateResult.assetSize)}
                    </span>
                  )}
                </div>

                {updateResult.releaseNotes && (
                  <div className="max-h-44 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed whitespace-pre-wrap text-zinc-700">
                    {updateResult.releaseNotes}
                  </div>
                )}

                {!canSelfUpdate && (
                  <p className="text-[11px] text-zinc-500">
                    Automatic in-app install is not available for this package. Open the release page to download it manually.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3.5">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-xs font-semibold text-emerald-900">You&apos;re up to date</p>
                  <p className="mt-0.5 text-[11px] text-emerald-700">
                    Astra v{currentVersion} is the latest available version.
                  </p>
                </div>
              </div>
            )
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/60 px-5 py-3.5">
          <button
            onClick={onOpenReleasePage}
            className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-900"
          >
            <ExternalLink className="size-3.5" />
            <span>Release Page</span>
          </button>

          <div className="flex items-center gap-2">
            {readyToRestart ? (
              <button
                onClick={onRestart}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700"
              >
                <RotateCcw className="size-3.5" />
                <span>Restart Astra</span>
              </button>
            ) : (
              <>
                <button
                  onClick={onCheck}
                  disabled={checking || installing}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw className={`size-3.5 ${checking ? 'animate-spin' : ''}`} />
                  <span>{checking ? 'Checking…' : 'Check Again'}</span>
                </button>

                {hasUpdate && canSelfUpdate && (
                  <button
                    onClick={onInstall}
                    disabled={installing}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download className="size-3.5" />
                    <span>{installing ? 'Installing…' : 'Update Now'}</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
