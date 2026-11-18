import { Profile, TunnelState, TunnelStatus, ServiceType } from '../bindings/github.com/pankajkumar/astra/models'
export type { Profile, TunnelState, LogEntry, PortForward } from '../bindings/github.com/pankajkumar/astra/models'
export { TunnelStatus, ServiceType } from '../bindings/github.com/pankajkumar/astra/models'

export interface ServicePreset {
  label: string
  port: number
  color: string
  darkColor: string
}

export const SERVICE_PRESETS: Record<ServiceType, ServicePreset> = {
  [ServiceType.ServicePostgres]: {
    label: 'PostgreSQL',
    port: 5432,
    color: 'bg-blue-50 text-blue-700 border-blue-200/80',
    darkColor: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  },
  [ServiceType.ServiceRedis]: {
    label: 'Redis',
    port: 6379,
    color: 'bg-red-50 text-red-700 border-red-200/80',
    darkColor: 'bg-red-500/15 text-red-300 border-red-500/30',
  },
  [ServiceType.ServiceValkey]: {
    label: 'Valkey',
    port: 6379,
    color: 'bg-rose-50 text-rose-700 border-rose-200/80',
    darkColor: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  },
  [ServiceType.ServiceElasticsearch]: {
    label: 'Elasticsearch',
    port: 9200,
    color: 'bg-amber-50 text-amber-700 border-amber-200/80',
    darkColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  [ServiceType.ServiceEventStreams]: {
    label: 'Event Streams',
    port: 9093,
    color: 'bg-purple-50 text-purple-700 border-purple-200/80',
    darkColor: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  },
  [ServiceType.ServiceCustom]: {
    label: 'Custom',
    port: 0,
    color: 'bg-zinc-100 text-zinc-700 border-zinc-200/80',
    darkColor: 'bg-zinc-800 text-zinc-300 border-zinc-700/60',
  },
  [ServiceType.$zero]: {
    label: 'Custom',
    port: 0,
    color: 'bg-zinc-100 text-zinc-700 border-zinc-200/80',
    darkColor: 'bg-zinc-800 text-zinc-300 border-zinc-700/60',
  },
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
    autoConnect: false,
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
