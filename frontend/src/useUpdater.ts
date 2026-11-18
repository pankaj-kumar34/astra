import { useState, useEffect, useCallback } from 'react'
import { Events } from '@wailsio/runtime'
import * as UpdaterService from '../bindings/github.com/pankajkumar/astra/updaterservice'
import type {
  AppVersionInfo,
  UpdateCheckResult,
  UpdateProgress,
} from '../bindings/github.com/pankajkumar/astra/models'

export type { AppVersionInfo, UpdateCheckResult, UpdateProgress }

export function useUpdater() {
  const [versionInfo, setVersionInfo] = useState<AppVersionInfo | null>(null)
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [progress, setProgress] = useState<UpdateProgress | null>(null)
  const [installing, setInstalling] = useState(false)
  const [installError, setInstallError] = useState<string | null>(null)

  const checkForUpdate = useCallback(async (silent = false) => {
    setChecking(true)
    if (!silent) {
      setCheckError(null)
    }
    try {
      const res = await UpdaterService.CheckForUpdate()
      setUpdateResult(res ?? null)
      setCheckError(null)
      return res ?? null
    } catch (err) {
      if (!silent) {
        setCheckError(err instanceof Error ? err.message : String(err))
      }
      return null
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    UpdaterService.GetVersionInfo()
      .then((info) => {
        if (!cancelled) setVersionInfo(info)
      })
      .catch(() => {})

    // Silent background check on launch
    UpdaterService.CheckForUpdate()
      .then((res) => {
        if (!cancelled && res) setUpdateResult(res)
      })
      .catch(() => {})

    const unsub = Events.On('updater:progress', (event) => {
      const p: UpdateProgress = event.data?.[0] ?? event.data ?? event
      if (p?.stage) {
        setProgress(p)
        if (p.stage === 'ready' || p.stage === 'error') {
          setInstalling(false)
        }
        if (p.stage === 'error' && p.message) {
          setInstallError(p.message)
        }
      }
    })
    return () => {
      cancelled = true
      if (typeof unsub === 'function') unsub()
    }
  }, [])

  const installUpdate = useCallback(async () => {
    if (!updateResult?.assetUrl) return
    setInstalling(true)
    setInstallError(null)
    setProgress({
      stage: 'downloading',
      percent: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      message: `Downloading ${updateResult.assetName || 'update'}...`,
    })

    try {
      await UpdaterService.DownloadAndInstallUpdate(
        updateResult.assetUrl,
        updateResult.assetName,
        updateResult.checksumUrl
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setInstallError(msg)
      setInstalling(false)
    }
  }, [updateResult])

  const restartApp = useCallback(async () => {
    try {
      await UpdaterService.RestartApp()
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  const openReleasePage = useCallback(async (url?: string) => {
    const target = url || updateResult?.releaseUrl || ''
    try {
      await UpdaterService.OpenReleasePage(target)
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : String(err))
    }
  }, [updateResult])

  const readyToRestart = progress?.stage === 'ready'

  return {
    versionInfo,
    updateResult,
    checking,
    checkError,
    progress,
    installing,
    readyToRestart,
    installError,
    checkForUpdate,
    installUpdate,
    restartApp,
    openReleasePage,
  }
}
