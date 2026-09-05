'use client';

import { useState } from 'react';
import { Play, Loader2, CheckCircle2, ShieldAlert, UserRound, RotateCcw } from 'lucide-react';

interface Props { total: number; initialProcessed?: number }

export function DashboardClient({ total, initialProcessed = 0 }: Props) {
  const [running, setRunning] = useState(false);
  const [processed, setProcessed] = useState(initialProcessed);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function runAgent() {
    setRunning(true); setDone(false); setError(null); setProcessed(0);
    const timer = window.setInterval(() => setProcessed((value) => Math.min(total, value + 4)), 90);
    try {
      const response = await fetch('/api/batch/run', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Agent analysis failed.');
      setProcessed(total);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run recovery agent.');
    } finally {
      window.clearInterval(timer);
      setRunning(false);
    }
  }

  const progress = total ? Math.min(100, Math.round((processed / total) * 100)) : 0;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Recovery Agent</p>
          <p className="mt-1 text-xs text-slate-500">Analyze at-risk revenue, recommend the safest recovery action, then pause for human authorization.</p>
        </div>
        <button onClick={runAgent} disabled={running || total === 0} className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-50">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? 'Agent analyzing…' : 'Run Recovery Agent'}
        </button>
      </div>

      {(running || done || error) && (
        <div className="mt-5 border-t border-slate-800 pt-5">
          <div className="mb-3 flex items-center justify-between text-xs">
            <span className="font-mono text-slate-400">{processed} / {total} analyzed</span>
            <span className="font-mono text-slate-500">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-sky-400 transition-all duration-100" style={{ width: `${progress}%` }} /></div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <BatchState icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Recommendation Ready" active={running || done} />
            <BatchState icon={<UserRound className="h-3.5 w-3.5" />} label="Human Approval" active={running || done} />
            <BatchState icon={<ShieldAlert className="h-3.5 w-3.5" />} label="Policy Gate" active={running || done} />
            <BatchState icon={<RotateCcw className="h-3.5 w-3.5" />} label="Execution Paused" active={done} />
          </div>
          {error && <p className="mt-3 rounded-lg border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">{error}</p>}
          {done && !error && <p className="mt-3 text-xs text-emerald-400">Agent analysis completed. Open the Review Queue to authorize or reject recovery actions.</p>}
        </div>
      )}
    </div>
  );
}

function BatchState({ icon, label, active }: { icon: React.ReactNode; label: string; active: boolean }) {
  return <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${active ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-slate-800 bg-slate-950 text-slate-600'}`}>{icon}{label}</div>;
}
