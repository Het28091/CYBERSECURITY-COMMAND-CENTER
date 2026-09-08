// Severity helpers — pill components with non-colour-only indicators.

import { ShieldAlert, Shield, AlertTriangle, Info, ShieldCheck } from 'lucide-react';
import type { Severity } from '@/lib/cyber/types';

const MAP: Record<Severity, { label: string; cls: string; icon: any }> = {
  critical: { label: 'CRITICAL', cls: 'text-red-500 border-red-500/50 bg-red-500/10', icon: ShieldAlert },
  high:     { label: 'HIGH',     cls: 'text-orange-500 border-orange-500/50 bg-orange-500/10', icon: ShieldAlert },
  medium:   { label: 'MEDIUM',   cls: 'text-amber-500 border-amber-500/50 bg-amber-500/10', icon: AlertTriangle },
  low:      { label: 'LOW',      cls: 'text-blue-400 border-blue-400/50 bg-blue-400/10', icon: Shield },
  info:     { label: 'INFO',     cls: 'text-slate-400 border-slate-400/50 bg-slate-400/10', icon: Info },
};

export function SeverityPill({ severity, size = 'sm' }: { severity: Severity; size?: 'xs' | 'sm' | 'md' }) {
  const m = MAP[severity] ?? MAP.info;
  const Icon = m.icon;
  const sizes = size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : size === 'md' ? 'text-xs px-2.5 py-1' : 'text-[11px] px-2 py-0.5';
  return (
    <span className={`inline-flex items-center gap-1 border rounded font-mono ${sizes} ${m.cls}`}>
      <Icon className={size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'} />
      {m.label}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const cls = statusColor(status);
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded border ${cls}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor(status)}`} />
      {status}
    </span>
  );
}

export function HealthPill({ health }: { health: string }) {
  const cls = healthColor(health);
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded border ${cls}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${healthDot(health)}`} />
      {health || 'UNKNOWN'}
    </span>
  );
}

export function VerificationPill({ status }: { status: string }) {
  const cls = verificationColor(status);
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded border ${cls}`}>
      {status}
    </span>
  );
}

export function FreshnessPill({ freshness }: { freshness: 'fresh' | 'stale' | 'unknown' }) {
  const m = {
    fresh:  'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
    stale:  'text-amber-400 border-amber-500/40 bg-amber-500/10',
    unknown:'text-slate-400 border-slate-500/40 bg-slate-500/10',
  }[freshness];
  return <span className={`inline-flex items-center text-[11px] font-mono px-2 py-0.5 rounded border ${m}`}>FRESHNESS: {freshness.toUpperCase()}</span>;
}

export function SourceLabelPill({ label }: { label: string }) {
  const m: Record<string, string> = {
    OFFICIAL_SOURCE: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
    SECONDARY_SOURCE: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
    AI_INTERPRETATION: 'text-purple-400 border-purple-500/40 bg-purple-500/10',
    UNVERIFIED: 'text-slate-400 border-slate-500/40 bg-slate-500/10',
    STALE: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
    VERIFIED: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
  };
  return <span className={`inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded border ${m[label] ?? m.UNVERIFIED}`}>{label}</span>;
}

function statusColor(s: string): string {
  const green = 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
  const red = 'text-red-400 border-red-500/40 bg-red-500/10';
  const amber = 'text-amber-400 border-amber-500/40 bg-amber-500/10';
  const slate = 'text-slate-400 border-slate-500/40 bg-slate-500/10';
  const blue = 'text-blue-400 border-blue-500/40 bg-blue-500/10';
  if (['HEALTHY', 'VERIFIED', 'DISCOVERED', 'STOPPED', 'COMPLETED', 'REGISTERED'].includes(s)) return green;
  if (['FAILED', 'UNHEALTHY', 'VERIFICATION_FAILED', 'KILLED', 'TIMEOUT'].includes(s)) return red;
  if (['DEGRADED', 'STARTING', 'STOPPING', 'DISCOVERING', 'VERIFICATION_PENDING', 'UNKNOWN'].includes(s)) return amber;
  if (['RUNNING', 'STARTED', 'VERIFYING'].includes(s)) return blue;
  return slate;
}

function dotColor(s: string): string {
  if (['HEALTHY', 'VERIFIED', 'DISCOVERED', 'STOPPED', 'COMPLETED', 'REGISTERED'].includes(s)) return 'bg-emerald-400';
  if (['FAILED', 'UNHEALTHY', 'VERIFICATION_FAILED'].includes(s)) return 'bg-red-400';
  if (['DEGRADED', 'STARTING', 'STOPPING', 'DISCOVERING'].includes(s)) return 'bg-amber-400';
  if (['RUNNING', 'STARTED'].includes(s)) return 'bg-blue-400 cyber-pulse';
  return 'bg-slate-400';
}

function healthColor(h: string): string {
  if (h === 'HEALTHY') return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
  if (h === 'DEGRADED') return 'text-amber-400 border-amber-500/40 bg-amber-500/10';
  if (h === 'UNHEALTHY') return 'text-red-400 border-red-500/40 bg-red-500/10';
  return 'text-slate-400 border-slate-500/40 bg-slate-500/10';
}
function healthDot(h: string): string {
  if (h === 'HEALTHY') return 'bg-emerald-400';
  if (h === 'DEGRADED') return 'bg-amber-400';
  if (h === 'UNHEALTHY') return 'bg-red-400';
  return 'bg-slate-400';
}
function verificationColor(v: string): string {
  if (v === 'VERIFIED') return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
  if (v === 'UNVERIFIED' || v === 'UNKNOWN') return 'text-slate-400 border-slate-500/40 bg-slate-500/10';
  if (v === 'VERIFYING') return 'text-blue-400 border-blue-500/40 bg-blue-500/10';
  if (v === 'REJECTED' || v === 'FAILED' || v === 'CONFLICT') return 'text-red-400 border-red-500/40 bg-red-500/10';
  if (v === 'STALE') return 'text-amber-400 border-amber-500/40 bg-amber-500/10';
  return 'text-slate-400 border-slate-500/40 bg-slate-500/10';
}
