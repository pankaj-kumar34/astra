import { useState, useEffect, useCallback, useRef } from 'react'
import { Events } from '@wailsio/runtime'
import * as AstraService from '../bindings/github.com/pankajkumar/astra/astraservice'
import { Profile, TunnelState, TunnelStatus, idleState } from './types'

export function useAstra() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [tunnelStates, setTunnelStates] = useState<Record<string, TunnelState>>({})
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Keep ref for latest states to avoid stale closures
  const statesRef = useRef(tunnelStates)
  statesRef.current = tunnelStates

  const refresh = useCallback(async () => {
    try {
      const [profs, states] = await Promise.all([
        AstraService.GetProfiles(),
        AstraService.GetAllTunnelStates(),
      ])
      setProfiles(profs ?? [])
      setTunnelStates((states ?? {}) as Record<string, TunnelState>)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()

    // Listen for tunnel state updates
    const unsub = Events.On('tunnel:state', (event: any) => {
      const state: TunnelState = event.data?.[0] ?? event.data ?? event
      if (state?.profileId) {
        setTunnelStates(prev => ({ ...prev, [state.profileId]: state }))
      }
    })

    return () => {
      if (typeof unsub === 'function') unsub()
    }
  }, [refresh])

  const getTunnelState = (profileId: string): TunnelState => {
    return tunnelStates[profileId] ?? idleState(profileId)
  }

  const saveProfile = async (profile: Profile): Promise<Profile> => {
    try {
      const saved = await AstraService.SaveProfile(profile)
      await refresh()
      return saved
    } catch (err) {
      console.error('SaveProfile error:', err)
      throw err
    }
  }

  const deleteProfile = async (id: string) => {
    await AstraService.DeleteProfile(id)
    if (selectedProfileId === id) setSelectedProfileId(null)
    await refresh()
  }

  const connect = async (profileId: string) => {
    setTunnelStates(prev => ({
      ...prev,
      [profileId]: { ...idleState(profileId), status: TunnelStatus.StatusConnecting },
    }))
    try {
      await AstraService.Connect(profileId)
    } catch (e: any) {
      setTunnelStates(prev => ({
        ...prev,
        [profileId]: { ...idleState(profileId), status: TunnelStatus.StatusError, error: String(e) },
      }))
    }
  }

  const disconnect = async (profileId: string) => {
    await AstraService.Disconnect(profileId)
  }

  const selectedProfile = profiles.find(p => p.id === selectedProfileId) ?? null

  return {
    profiles,
    tunnelStates,
    selectedProfileId,
    selectedProfile,
    loading,
    setSelectedProfileId,
    getTunnelState,
    saveProfile,
    deleteProfile,
    connect,
    disconnect,
    refresh,
  }
}
