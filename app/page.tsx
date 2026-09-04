import Link from 'next/link';
import { inMemoryStore } from '@/lib/db/inMemoryStore';
import { DashboardClient } from '@/components/dashboard/DashboardClient';
import { AlertTriangle, ArrowUpRight, Ban, CheckCircle2, Clock3, Gauge, ShieldCheck, Users } from 'lucide-react';

const money = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;
const lossLabels: Record<string, string> = { failed_payment: 'Failed Payment', abandoned_checkout: 'Abandoned Checkout', subscription_failure: 'Subscription', overdue_receivable: 'Receivable' };
const strategyLabels: Record<string, string> = { retry_payment: 'Retry Payment', send_payment_link: 'Payment Link', retry_mandate: 'Retry Mandate', escalate_receivables: 'Escalate Receivable', human_review: 'Human Review', no_action: 'No Action' };

export default function HomePage() {
  const txs = inMemoryStore.getTransactions();
  const decisions = inMemoryStore.getAIDecisions();
  const policies = inMemoryStore.getPolicyDecisions();
  const attempts = inMemoryStore.getRecoveryAttempts();
  const results = inMemoryStore.getRecoveryResults();
  const reviews = inMemoryStore.getHumanReviews('PENDING');
  const atRisk = txs.reduce((sum, t) => sum + t.amount_in_inr, 0);
  const attemptedAmount = attempts.reduce((sum, a) => sum + (txs.find((t) => t.id === a.transaction_id)?.amount_in_inr ?? 0), 0);
  const recovered = results.reduce((sum, r) => sum + r.recovered_amount_in_inr, 0);
  const recoveryRate = attemptedAmount ? (recovered / attemptedAmount) * 100 : 0;
  const blocked = policies.filter((p) => p.decision === 'BLOCK').length;
  const allowed = policies.filter((p) => p.decision === 'ALLOW').length;
  const strategyCounts = decisions.reduce<Record<string, number>>((acc, d) => { acc[d.recommended_strategy] = (acc[d.recommended_strategy] ?? 0) + 1; return acc; }, {});
  const lossCounts = txs.reduce<Record<string, number>>((acc, t) => { acc[t.loss_type] = (acc[t.loss_type] ?? 0) + 1; return acc; }, {});

  return (
    <main className="space-y-6 pb-10">
      <section className="flex flex-col gap-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-6 shadow-sm md:flex-row md:items-end md:justify-between">
        <div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-[11px] font-medium text-slate-400"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Policy-governed recovery</div><h1 className="text-3xl font-semibold tracking-tight text-white">Revenue Recovery Control Center</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Monitor at-risk revenue, governed AI recommendations, verified recovery outcomes, and operator escalations from one ledger.</p></div>
        <div className="flex items-center gap-3 text-xs text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Demo simulation active <Link href="/audit" className="font-medium text-sky-400 hover:text-sky-300">View audit →</Link></div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7">
        <Kpi label="Revenue at Risk" value={money(atRisk)} icon={<AlertTriangle />} tone="rose" /><Kpi label="Recovery Attempted" value={money(attemptedAmount)} icon={<ArrowUpRight />} tone="sky" /><Kpi label="Revenue Recovered" value={money(recovered)} icon={<CheckCircle2 />} tone="emerald" /><Kpi label="Recovery Rate" value={`${recoveryRate.toFixed(1)}%`} icon={<Gauge />} tone="emerald" /><Kpi label="Transactions" value={txs.length.toLocaleString()} icon={<Clock3 />} tone="slate" /><Kpi label="Human Reviews" value={reviews.length.toLocaleString()} icon={<Users />} tone="amber" /><Kpi label="Blocked Actions" value={blocked.toLocaleString()} icon={<Ban />} tone="rose" />
      </section>

      <DashboardClient total={txs.length} />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Recovery strategy breakdown" subtitle="AI recommendations recorded in the decision ledger"><div className="space-y-3">{Object.entries(strategyCounts).length ? Object.entries(strategyCounts).map(([strategy, count]) => <MetricBar key={strategy} label={strategyLabels[strategy] ?? strategy} value={count} total={decisions.length} />) : <Empty text="No AI decisions recorded yet." />}</div></Panel>
        <Panel title="AI vs control" subtitle="Verified AI recovery compared with recorded control baseline"><div className="rounded-xl border border-dashed border-slate-800 px-4 py-7 text-center"><p className="text-xs text-slate-500">Control baseline is available when control-group outcomes are recorded.</p><p className="mt-2 text-2xl font-semibold text-emerald-400">{money(recovered)}</p><p className="mt-1 text-[11px] text-slate-500">AI verified recovery</p></div></Panel>
        <Panel title="Incremental recovery" subtitle="Recovery attributable to the governed recovery program"><div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"><p className="text-xs text-slate-500">Verified recovered revenue</p><p className="mt-2 text-3xl font-semibold text-emerald-400">{money(recovered)}</p><p className="mt-2 text-xs text-slate-500">No unverified revenue is counted.</p></div></Panel>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-semibold text-white">Loss mix</h2><p className="mt-1 text-xs text-slate-500">Current transaction population</p></div><Link href="/transactions" className="text-xs font-medium text-sky-400">Open ledger →</Link></div><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Object.entries(lossCounts).map(([loss, count]) => <Link key={loss} href={`/transactions?lossType=${loss}`} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 hover:border-slate-700"><p className="text-[11px] text-slate-500">{lossLabels[loss] ?? loss}</p><p className="mt-1 text-xl font-semibold text-slate-100">{count}</p></Link>)}</div></section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-semibold text-white">Recent recovery activity</h2><p className="mt-1 text-xs text-slate-500">Policy-gated transactions and verified outcomes</p></div><Link href="/transactions" className="text-xs font-medium text-sky-400">Open transaction ledger →</Link></div>{txs.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-3">Transaction</th><th className="px-3 py-3">Loss type</th><th className="px-3 py-3">Amount</th><th className="px-3 py-3">Policy</th><th className="px-3 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-800/70">{txs.slice(0, 8).map((t) => { const p = policies.find((item) => item.transaction_id === t.id); return <tr key={t.id} className="hover:bg-slate-900/60"><td className="px-3 py-3 font-mono text-slate-200">{t.original_reference_id}<span className="ml-2 text-slate-600">{t.customer_id}</span></td><td className="px-3 py-3 text-slate-400">{lossLabels[t.loss_type]}</td><td className="px-3 py-3 font-mono text-slate-200">{money(t.amount_in_inr)}</td><td className="px-3 py-3"><Status value={p?.decision ?? 'PENDING'} /></td><td className="px-3 py-3"><Status value={t.status} /></td></tr>; })}</tbody></table></div> : <Empty text="No transactions available." />}</section>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500"><span className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1">{allowed} allowed</span><span className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1">{reviews.length} human review</span><span className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1">{blocked} blocked</span><span className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1">Verified recovery only</span></div>
    </main>
  );
}
function Kpi({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: 'rose' | 'sky' | 'emerald' | 'amber' | 'slate' }) { const tones = { rose: 'text-rose-400', sky: 'text-sky-400', emerald: 'text-emerald-400', amber: 'text-amber-400', slate: 'text-slate-300' }; return <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><div className="flex items-center justify-between"><span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</span><span className={tones[tone]}>{icon}</span></div><p className="mt-3 text-xl font-semibold tracking-tight text-slate-100">{value}</p></div>; }
function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"><h2 className="text-sm font-semibold text-white">{title}</h2><p className="mb-5 mt-1 text-[11px] text-slate-500">{subtitle}</p>{children}</section>; }
function MetricBar({ label, value, total }: { label: string; value: number; total: number }) { const pct = total ? (value / total) * 100 : 0; return <div><div className="mb-1 flex justify-between text-xs"><span className="text-slate-300">{label}</span><span className="font-mono text-slate-500">{value}</span></div><div className="h-1.5 rounded-full bg-slate-800"><div className="h-full rounded-full bg-sky-400" style={{ width: `${pct}%` }} /></div></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-slate-800 px-4 py-8 text-center text-xs text-slate-500">{text}</div>; }
function Status({ value }: { value: string }) { const v = value.toLowerCase(); const cls = v.includes('block') || v.includes('reject') ? 'border-rose-900/60 bg-rose-950/30 text-rose-300' : v.includes('review') || v.includes('human') ? 'border-amber-900/60 bg-amber-950/30 text-amber-300' : v.includes('recover') || v.includes('allow') || v.includes('success') ? 'border-emerald-900/60 bg-emerald-950/30 text-emerald-300' : 'border-slate-800 bg-slate-900 text-slate-400'; return <span className={`rounded-md border px-2 py-1 text-[10px] font-medium ${cls}`}>{value.replaceAll('_', ' ')}</span>; }
