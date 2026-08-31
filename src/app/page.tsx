import { env } from '@/lib/config/env';

export default function HomePage() {
  return (
    <div className="space-y-8">
      <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/50">
        <h1 className="text-2xl font-bold text-slate-100 mb-2">
          RecoverAI Foundation Initialized
        </h1>
        <p className="text-sm text-slate-400">
          RecoverAI is operating in <code className="text-sky-400 font-semibold">{env.EXECUTION_MODE}</code>.
          Zero external credentials required for local demo evaluation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-lg border border-slate-800 bg-slate-900/30">
          <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Foundation Layer</span>
          <p className="text-lg font-semibold text-emerald-400 mt-1">Phase 1 Complete</p>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">TypeScript Strict · Next.js 14 App Router · Zod Contract Validation</p>
        </div>
        <div className="p-5 rounded-lg border border-slate-800 bg-slate-900/30">
          <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Safety Architecture</span>
          <p className="text-lg font-semibold text-amber-400 mt-1">Deterministic Policy</p>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">AI suggests strategies · Hard policy rules govern execution</p>
        </div>
        <div className="p-5 rounded-lg border border-slate-800 bg-slate-900/30">
          <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Simulation Adapter</span>
          <p className="text-lg font-semibold text-sky-400 mt-1">Zero-Key Demo</p>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">In-memory state machine ready for full test lifecycle</p>
        </div>
      </div>
    </div>
  );
}
