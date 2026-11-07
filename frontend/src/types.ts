import { Profile, TunnelState, TunnelStatus, ServiceType } from '../bindings/github.com/pankajkumar/astra/models'
export type { Profile, TunnelState, LogEntry, PortForward } from '../bindings/github.com/pankajkumar/astra/models'
export { TunnelStatus, ServiceType } from '../bindings/github.com/pankajkumar/astra/models'

export const SERVICE_PRESETS: Record<ServiceType, { label: string; port: number; color: string }> = {
  [ServiceType.ServicePostgres]:      { label: 'PostgreSQL',    port: 5432, color: 'bg-blue-50 text-blue-600 border-blue-200' },
  [ServiceType.ServiceRedis]:         { label: 'Redis',         port: 6379, color: 'bg-red-50 text-red-600 border-red-200' },
  [ServiceType.ServiceValkey]:        { label: 'Valkey',        port: 6379, color: 'bg-rose-50 text-rose-600 border-rose-200' },
  [ServiceType.ServiceElasticsearch]: { label: 'Elasticsearch', port: 9200, color: 'bg-amber-50 text-amber-600 border-amber-200' },
  [ServiceType.ServiceEventStreams]:  { label: 'Event Streams', port: 9093, color: 'bg-purple-50 text-purple-600 border-purple-200' },
  [ServiceType.ServiceCustom]:        { label: 'Custom',        port: 0,    color: 'bg-zinc-100 text-zinc-500 border-zinc-300' },
  [ServiceType.$zero]:                { label: 'Unknown',       port: 0,    color: 'bg-zinc-100 text-zinc-500 border-zinc-300' },
}

export function emptyProfile(): Profile {
  return {
    id: '',
    name: '',
    host: '',
    port: 22,
    user: '',
    keyPath: '~/.ssh/id_rsa',
    description: '',
    forwards: [],
    createdAt: '',
    updatedAt: '',
  }
}

export function idleState(profileId: string): TunnelState {
  return {
    profileId,
    status: TunnelStatus.StatusIdle,
    pid: 0,
    startedAt: null,
    error: '',
    logs: [],
    portHealth: {},
  }
}
