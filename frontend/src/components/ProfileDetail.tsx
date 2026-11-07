import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Profile,
  TunnelState,
  TunnelStatus,
  SERVICE_PRESETS,
  LogEntry,
} from "@/types";
import { StatusBadge } from "./StatusBadge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Server,
  Key,
  User,
  ArrowRightLeft,
  Clock,
  AlertCircle,
  Terminal,
  Pencil,
  Trash2,
  Copy,
  Check,
  CopyPlus,
} from "lucide-react";

interface Props {
  profile: Profile;
  state: TunnelState;
  onConnect: () => void;
  onDisconnect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

function formatUptime(startedAt: string | null): string {
  if (!startedAt) return "—";
  const diff = Date.now() - new Date(startedAt).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
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
  const [activeTab, setActiveTab] = useState<"overview" | "logs">("overview");
  const [, setTick] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isConnected = state.status === TunnelStatus.StatusConnected;
  const isConnecting = state.status === TunnelStatus.StatusConnecting;
  const isError = state.status === TunnelStatus.StatusError;
  const isActive = isConnected || isConnecting || isError;

  // Tick every second when active (for uptime display)
  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isActive]);

  // Reset delete confirmation when profile changes
  useEffect(() => { setConfirmDelete(false) }, [profile.id]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#f4f4f5",
      }}
    >
      {/* Header — also serves as drag region */}
      <div
       
        style={{
          padding: "52px 28px 16px",
          borderBottom: "1px solid #e4e4e7",
          background: "#fff",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: isConnected ? "#ecfdf5" : "#f4f4f5",
                border: `1px solid ${isConnected ? "#a7f3d0" : "#e4e4e7"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Server
                style={{
                  width: 18,
                  height: 18,
                  color: isConnected ? "#10b981" : "#a1a1aa",
                }}
              />
            </div>
            <div>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#18181b",
                  margin: 0,
                  letterSpacing: "-0.02em",
                }}
              >
                {profile.name}
              </h2>
              {profile.description && (
                <p
                  style={{ fontSize: 12, color: "#71717a", margin: "2px 0 0" }}
                >
                  {profile.description}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={onDuplicate}
              title="Duplicate profile"
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: "#f4f4f5", border: "1px solid #e4e4e7",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#e4e4e7")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#f4f4f5")}
            >
              <CopyPlus style={{ width: 13, height: 13, color: "#71717a" }} />
            </button>
            <button
              onClick={onEdit}
              title="Edit profile"
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: "#f4f4f5", border: "1px solid #e4e4e7",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#e4e4e7")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#f4f4f5")}
            >
              <Pencil style={{ width: 13, height: 13, color: "#71717a" }} />
            </button>
            {confirmDelete ? (
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <button
                  onClick={onDelete}
                  style={{
                    height: 32, padding: "0 10px", borderRadius: 8, border: "none",
                    background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{
                    height: 32, padding: "0 10px", borderRadius: 8,
                    background: "#f4f4f5", border: "1px solid #e4e4e7",
                    fontSize: 11, color: "#71717a", cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                title="Delete profile"
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: "#f4f4f5", border: "1px solid #e4e4e7",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#fef2f2";
                  e.currentTarget.style.borderColor = "#fca5a5";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#f4f4f5";
                  e.currentTarget.style.borderColor = "#e4e4e7";
                }}
              >
                <Trash2 style={{ width: 13, height: 13, color: "#71717a" }} />
              </button>
            )}
          </div>
        </div>

        {/* Status row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <StatusBadge status={state.status} dark={false} />
            {(isConnected || isConnecting) && state.startedAt && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#71717a" }}>
                <Clock style={{ width: 11, height: 11 }} />
                {formatUptime(state.startedAt)}
              </span>
            )}
            {isConnected && state.pid > 0 && (
              <span style={{ fontSize: 11, color: "#a1a1aa", fontFamily: "monospace" }}>
                PID {state.pid}
              </span>
            )}
          </div>
          <button
            onClick={isActive ? onDisconnect : onConnect}
            style={{
              height: 32,
              padding: "0 16px",
              borderRadius: 8,
              border: "none",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              background: isActive ? "#e4e4e7" : "#10b981",
              color: isActive ? "#3f3f46" : "#fff",
              boxShadow: isActive ? "none" : "0 2px 8px rgba(16,185,129,0.3)",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isActive ? "#d4d4d8" : "#059669";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isActive ? "#e4e4e7" : "#10b981";
            }}
          >
            {isActive ? "Disconnect" : "Connect"}
          </button>
        </div>

        {/* Error */}
        {isError && state.error && (
          <div
            style={{
              marginTop: 10,
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              background: "#fef2f2",
              border: "1px solid #fca5a5",
              borderRadius: 8,
              padding: "8px 12px",
            }}
          >
            <AlertCircle
              style={{
                width: 13,
                height: 13,
                color: "#ef4444",
                flexShrink: 0,
                marginTop: 1,
              }}
            />
            <p
              style={{
                fontSize: 12,
                color: "#dc2626",
                margin: 0,
                fontFamily: "monospace",
              }}
            >
              {state.error}
            </p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: "10px 28px 0",
          background: "#fff",
          borderBottom: "1px solid #e4e4e7",
        }}
      >
        {(["overview", "logs"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "6px 12px",
              borderRadius: "6px 6px 0 0",
              border: "none",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              textTransform: "capitalize",
              background: activeTab === tab ? "#f4f4f5" : "transparent",
              color: activeTab === tab ? "#18181b" : "#71717a",
              borderBottom:
                activeTab === tab
                  ? "2px solid #10b981"
                  : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {tab === "logs" ? (
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Terminal style={{ width: 11, height: 11 }} />
                Logs
                {(state.logs?.length ?? 0) > 0 && (
                  <span
                    style={{
                      background: "#e4e4e7",
                      color: "#52525b",
                      borderRadius: 4,
                      padding: "0 4px",
                      fontSize: 10,
                    }}
                  >
                    {state.logs?.length}
                  </span>
                )}
              </span>
            ) : (
              tab
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "hidden", padding: "20px 28px" }}>
        {activeTab === "overview" ? (
          <OverviewTab profile={profile} isConnected={isConnected} portHealth={state.portHealth ?? {}} />
        ) : (
          <LogViewer logs={state.logs ?? []} />
        )}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      title="Copy connection string"
      style={{
        background: "none", border: "none", cursor: "pointer", padding: 3,
        borderRadius: 4, display: "flex", alignItems: "center", color: copied ? "#10b981" : "#a1a1aa",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => { if (!copied) e.currentTarget.style.color = "#52525b" }}
      onMouseLeave={(e) => { if (!copied) e.currentTarget.style.color = "#a1a1aa" }}
    >
      {copied
        ? <Check style={{ width: 12, height: 12 }} />
        : <Copy style={{ width: 12, height: 12 }} />
      }
    </button>
  );
}

function OverviewTab({
  profile,
  isConnected,
  portHealth,
}: {
  profile: Profile;
  isConnected: boolean;
  portHealth: Record<string, boolean | undefined>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Connection details */}
      <div>
        <p
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#a1a1aa",
            margin: "0 0 10px",
          }}
        >
          Connection Details
        </p>
        <div
          style={{
            background: "#fff",
            border: "1px solid #e4e4e7",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {[
            {
              icon: <Server style={{ width: 13, height: 13 }} />,
              label: "Host",
              value: `${profile.host}:${profile.port}`,
              mono: true,
            },
            {
              icon: <User style={{ width: 13, height: 13 }} />,
              label: "User",
              value: profile.user,
              mono: true,
            },
            {
              icon: <Key style={{ width: 13, height: 13 }} />,
              label: "Key",
              value: profile.keyPath,
              mono: true,
            },
          ].map((row, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                borderBottom: i < 2 ? "1px solid #f4f4f5" : "none",
              }}
            >
              <span style={{ color: "#a1a1aa", flexShrink: 0 }}>
                {row.icon}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "#a1a1aa",
                  width: 36,
                  flexShrink: 0,
                }}
              >
                {row.label}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: "#18181b",
                  fontFamily: row.mono ? "monospace" : "inherit",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {row.value || "—"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Port Forwards */}
      <div>
        <p
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#a1a1aa",
            margin: "0 0 10px",
          }}
        >
          Port Forwards
        </p>
        {(profile.forwards?.length ?? 0) === 0 ? (
          <p style={{ fontSize: 12, color: "#a1a1aa" }}>
            No port forwards configured
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(profile.forwards ?? []).map((fwd) => {
              const preset = SERVICE_PRESETS[fwd.service];
              return (
                <div
                  key={fwd.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "#fff",
                    border: "1px solid #e4e4e7",
                    borderRadius: 8,
                    padding: "9px 14px",
                  }}
                >
                  <span
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0",
                      preset?.color ??
                        "bg-zinc-100 text-zinc-500 border-zinc-200",
                    )}
                  >
                    {fwd.label || preset?.label}
                  </span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      fontFamily: "monospace",
                      color: "#52525b",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <span style={{ color: "#18181b", fontWeight: 600 }}>
                      :{fwd.localPort}
                    </span>
                    <ArrowRightLeft
                      style={{
                        width: 11,
                        height: 11,
                        color: "#a1a1aa",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fwd.remoteHost}:{fwd.remotePort}
                    </span>
                  </div>
                  {isConnected && (() => {
                    const key = String(fwd.localPort)
                    const known = portHealth[key] !== undefined
                    const healthy = portHealth[key] === true
                    const color = !known ? "#a1a1aa" : healthy ? "#10b981" : "#ef4444"
                    const shadow = !known ? "none" : healthy ? "0 0 6px rgba(16,185,129,0.5)" : "0 0 6px rgba(239,68,68,0.5)"
                    return (
                      <div
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: color,
                          flexShrink: 0,
                          boxShadow: shadow,
                        }}
                      />
                    )
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Connect hints */}
      {isConnected && (profile.forwards?.length ?? 0) > 0 && (
        <div>
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#a1a1aa",
              margin: "0 0 10px",
            }}
          >
            Connect Via
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(profile.forwards ?? []).map((fwd) => {
              const hint = connectHint(fwd.service, fwd.localPort);
              return hint ? (
                <div
                  key={fwd.id}
                  style={{
                    background: "#18181b", borderRadius: 8, padding: "8px 12px",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                  }}
                >
                  <div>
                    <p style={{ fontSize: 10, color: "#71717a", margin: "0 0 3px" }}>
                      {fwd.label || SERVICE_PRESETS[fwd.service]?.label}
                    </p>
                    <code style={{ fontSize: 12, color: "#34d399", fontFamily: "monospace" }}>
                      {hint}
                    </code>
                  </div>
                  <CopyButton text={hint} />
                </div>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function connectHint(service: string, localPort: number): string | null {
  switch (service) {
    case "postgres":
      return `psql -h localhost -p ${localPort}`;
    case "redis":
    case "valkey":
      return `redis-cli -h localhost -p ${localPort}`;
    case "elasticsearch":
      return `curl http://localhost:${localPort}`;
    case "eventstreams":
      return `localhost:${localPort} (Kafka)`;
    default:
      return null;
  }
}

function LogViewer({ logs }: { logs: LogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  if (logs.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8 }}>
        <Terminal style={{ width: 28, height: 28, color: "#d4d4d8" }} />
        <p style={{ fontSize: 12, color: "#a1a1aa", margin: 0 }}>No logs yet</p>
      </div>
    );
  }
  return (
    <ScrollArea className="h-full">
      <div style={{ background: "#18181b", borderRadius: 10, padding: "10px 14px", fontFamily: "monospace" }}>
        {logs.map((entry, i) => (
          <div key={i} style={{ display: "flex", gap: 10, padding: "2px 0", fontSize: 11 }}>
            <span style={{ color: "#52525b", flexShrink: 0 }}>
              {new Date(entry.timestamp).toLocaleTimeString()}
            </span>
            <span style={{ color: entry.level === "error" ? "#f87171" : entry.level === "warn" ? "#fbbf24" : "#a1a1aa", wordBreak: "break-all" }}>
              {entry.line}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
