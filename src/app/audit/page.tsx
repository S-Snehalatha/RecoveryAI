import { inMemoryStore } from '@/lib/db/inMemoryStore';
import { AuditLog } from '@/types';
import { ShieldCheck, Lock } from 'lucide-react';
import Link from 'next/link';

export default function AuditPage() {
  const auditLogs = inMemoryStore.getAuditLogs();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/" className="hover:text-slate-200">Dashboard</Link>
            <span>/</span>
            <span className="text-slate-200">Audit Ledger</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Cryptographic Audit Trail</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Append-only tamper-evident ledger recording all state transitions and policy decisions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
            <Lock className="h-3 w-3" /> SHA-256 VERIFIED
          </span>
        </div>
      </div>

      {auditLogs.length === 0 ? (
        <div className="p-12 rounded-xl border border-slate-800 bg-slate-900/40 text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-sky-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-200">Ledger Ready & Active</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Audit entries are automatically committed upon every AI diagnosis, policy rule evaluation, and gateway dispatch in Phases 3-5.
          </p>
          <div className="pt-2">
            <Link
              href="/transactions"
              className="inline-flex items-center gap-2 text-xs font-semibold text-sky-400 hover:text-sky-300"
            >
              Browse Ingested Records →
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {auditLogs.map((log: AuditLog) => (
            <div key={log.id} className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>{log.action_type}</span>
                <span>{log.created_at}</span>
              </div>
              <p className="text-slate-200 mt-1">Actor: {log.actor_type} ({log.actor_id})</p>
              <div className="text-[11px] text-slate-500 mt-1">Hash: {log.checksum_hash}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}