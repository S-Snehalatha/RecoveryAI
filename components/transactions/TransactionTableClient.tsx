'use client';

import { useMemo, useState } from 'react';
import { Transaction, AIDecision, PolicyDecisionRecord, RecoveryAttempt, RecoveryResult, AuditLog } from '@/types';
import { Search, X, Loader2, ChevronRight, ShieldCheck, Brain, ReceiptText, Clock3 } from 'lucide-react';

interface Props { initialTransactions: Transaction[]; initialLossType?: string; initialScenario?: string }
type Filter = 'all' | 'failed_payment' | 'abandoned_checkout' | 'subscription_failure' | 'overdue_receivable' | 'human_review' | 'blocked' | 'recovered' | 'failed';
const lossLabel: Record<string, string> = { failed_payment: 'Failed Payment', abandoned_checkout: 'Abandoned Checkout', subscription_failure: 'Subscription', overdue_receivable: 'Receivable' };
const strategyLabel: Record<string, string> = { retry_payment: 'Retry Payment', send_payment_link: 'Payment Link', retry_mandate: 'Retry Mandate', escalate_receivables: 'Escalate Receivable', human_review: 'Human Review', no_action: 'No Action' };
const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export function TransactionTableClient({ initialTransactions, initialLossType, initialScenario }: Props) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [filter, setFilter] = useState<Filter>((initialLossType as Filter) || 'all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [decisions] = useState<Record<string, AIDecision>>({});
  const [policies] = useState<Record<string, PolicyDecisionRecord>>({});
  const [attempts] = useState<Record<string, RecoveryAttempt>>({});
  const [results] = useState<Record<string, RecoveryResult>>({});
  const [audits] = useState<Record<string, AuditLog[]>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => transactions.filter((t) => {
    if (initialScenario && t.demo_scenario !== initialScenario) return false;
    if (filter !== 'all') {
      if (filter === 'human_review' && t.status !== 'NEEDS_HUMAN_REVIEW') return false;
      if (filter === 'blocked' && t.status !== 'REJECTED_BY_POLICY' && t.status !== 'blocked') return false;
      if (filter === 'recovered' && t.status !== 'RECOVERED' && t.status !== 'recovered') return false;
      if (filter === 'failed' && t.status !== 'RECOVERY_FAILED' && t.status !== 'failed') return false;
      if (!['human_review','blocked','recovered','failed'].includes(filter) && t.loss_type !== filter) return false;
    }
    const q = query.trim().toLowerCase();
    return !q || t.id.toLowerCase().includes(q) || t.original_reference_id.toLowerCase().includes(q) || t.customer_id.toLowerCase().includes(q);
  }), [transactions, filter, query, initialScenario]);

  async function diagnose(tx: Transaction) {
    setLoading(tx.id); setError(null);
    try {
      const response = await fetch('/api/ai/diagnose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transactionId: tx.id }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Diagnosis failed.');
      if (data.transaction) setTransactions((items) => items.map((item) => item.id === tx.id ? data.transaction : item));
      setSelected(tx);
    } catch (err) { setError(err instanceof Error ? err.message : 'Diagnosis failed.'); }
    finally { setLoading(null); }
  }

  function openDetail(tx: Transaction) { setSelected(tx); setError(null); }
  const selectedDecision = selected ? decisions[selected.id] : undefined;
  const selectedPolicy = selected ? policies[selected.id] : undefined;
  const selectedAttempt = selected ? attempts[selected.id] : undefined;
  const selectedResult = selected ? results[selected.id] : undefined;
  const selectedAudits = selected ? audits[selected.id] ?? [] : [];

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full lg:max-w-md"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-600" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search transaction ID or customer ID" className="w-full rounded-xl border border-slate-800 bg-slate-900 px-9 py-2.5 text-xs text-slate-200 outline-none focus:border-sky-500" /></div>
      <div className="flex gap-2 overflow-x-auto pb-1">{(['all','failed_payment','abandoned_checkout','subscription_failure','overdue_receivable','human_review','blocked','recovered','failed'] as Filter[]).map((item) => <button key={item} onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-lg border px-3 py-2 text-[11px] font-medium ${filter === item ? 'border-sky-500/40 bg-sky-500/10 text-sky-300' : 'border-slate-800 text-slate-500 hover:text-slate-300'}`}>{item === 'all' ? 'All' : item === 'human_review' ? 'Human Review' : item === 'blocked' ? 'Blocked' : item === 'recovered' ? 'Recovered' : item === 'failed' ? 'Failed' : lossLabel[item] ?? item}</button>)}</div>
    </div>

    {error && <div className="rounded-xl border border-rose-900/60 bg-rose-950/20 px-4 py-3 text-xs text-rose-300">{error}</div>}
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70">
      <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-xs"><thead className="border-b border-slate-800 bg-slate-950 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Transaction</th><th className="px-4 py-3">Loss Type</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">AI Recommendation</th><th className="px-4 py-3">Confidence</th><th className="px-4 py-3">Policy</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Recovered</th><th className="px-4 py-3" /></tr></thead>
      <tbody className="divide-y divide-slate-800/70">{filtered.map((tx) => { const d = decisions[tx.id]; const p = policies[tx.id]; const r = results[tx.id]; return <tr key={tx.id} onClick={() => openDetail(tx)} className="cursor-pointer hover:bg-slate-900/70"><td className="px-4 py-3"><p className="font-mono text-slate-200">{tx.original_reference_id}</p><p className="mt-0.5 font-mono text-[10px] text-slate-600">{tx.customer_id}</p></td><td className="px-4 py-3 text-slate-400">{lossLabel[tx.loss_type] ?? tx.loss_type}</td><td className="px-4 py-3 font-mono font-medium text-slate-200">{money(tx.amount_in_inr)}</td><td className="px-4 py-3">{d ? <span className="text-slate-200">{strategyLabel[d.recommended_strategy] ?? d.recommended_strategy}</span> : <button onClick={(e) => { e.stopPropagation(); diagnose(tx); }} disabled={loading === tx.id} className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-sky-300">{loading === tx.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}{loading === tx.id ? 'Diagnosing' : 'Run diagnosis'}</button>}</td><td className="px-4 py-3 font-mono text-slate-400">{d ? `${Math.round(d.confidence_score * 100)}%` : '—'}</td><td className="px-4 py-3"><State value={p?.decision ?? 'Pending'} /></td><td className="px-4 py-3"><State value={tx.status} /></td><td className="px-4 py-3 font-mono text-emerald-400">{r ? money(r.recovered_amount_in_inr) : '—'}</td><td className="px-4 py-3 text-slate-600"><ChevronRight className="h-4 w-4" /></td></tr>})}</tbody></table></div>
      {!filtered.length && <div className="px-6 py-14 text-center"><ReceiptText className="mx-auto h-8 w-8 text-slate-700" /><p className="mt-3 text-sm text-slate-400">No transactions match these filters.</p><p className="mt-1 text-xs text-slate-600">Try another status or search term.</p></div>}
    </div>

    {selected && <Detail tx={selected} decision={selectedDecision} policy={selectedPolicy} attempt={selectedAttempt} result={selectedResult} audits={selectedAudits} onClose={() => setSelected(null)} />}
  </div>;
}

function Detail({ tx, decision, policy, attempt, result, audits, onClose }: { tx: Transaction; decision?: AIDecision; policy?: PolicyDecisionRecord; attempt?: RecoveryAttempt; result?: RecoveryResult; audits: AuditLog[]; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/60 p-0 sm:p-4"><aside className="h-full w-full overflow-y-auto border-l border-slate-800 bg-slate-950 p-5 shadow-2xl sm:max-w-2xl sm:rounded-2xl"><div className="flex items-start justify-between border-b border-slate-800 pb-4"><div><p className="font-mono text-[10px] text-slate-500">TRANSACTION DETAIL</p><h2 className="mt-1 text-xl font-semibold text-white">{tx.original_reference_id}</h2><p className="mt-1 text-xs text-slate-500">{tx.customer_id} · {tx.customer_name}</p></div><button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-900 hover:text-white"><X className="h-5 w-5" /></button></div>
    <div className="grid grid-cols-2 gap-3 py-5 sm:grid-cols-4"><Info label="Amount" value={money(tx.amount_in_inr)} /><Info label="Loss" value={lossLabel[tx.loss_type] ?? tx.loss_type} /><Info label="Method" value={tx.payment_method} /><Info label="Status" value={tx.status} /></div>
    <Section title="AI diagnosis" icon={<Brain className="h-4 w-4" />}>{decision ? <><Row label="Diagnosis" value={decision.diagnosis_code} /><Row label="Recommendation" value={strategyLabel[decision.recommended_strategy] ?? decision.recommended_strategy} /><Row label="Confidence" value={`${Math.round(decision.confidence_score * 100)}%`} /><div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-xs leading-5 text-slate-300">{decision.concise_rationale}</div></> : <EmptyDetail text="No AI diagnosis has been recorded for this transaction." />}</Section>
    <Section title="Policy decision" icon={<ShieldCheck className="h-4 w-4" />}>{policy ? <><Row label="Decision" value={policy.decision} /><Row label="Approved strategy" value={policy.approved_strategy ? strategyLabel[policy.approved_strategy] ?? policy.approved_strategy : 'None'} /><Row label="Policy reason" value={policy.violation_reasons.length ? policy.violation_reasons.join('; ') : policy.matched_rules.join('; ') || 'No rule detail recorded'} /></> : <EmptyDetail text="Policy evaluation is not yet available." />}</Section>
    <Section title="Execution & outcome" icon={<ReceiptText className="h-4 w-4" />}>{attempt ? <><Row label="Execution" value={attempt.execution_mode} /><Row label="Gateway status" value={attempt.gateway_status} /><Row label="Attempt status" value={attempt.status} />{result && <><Row label="Outcome" value={result.outcome_status} /><Row label="Recovered amount" value={money(result.recovered_amount_in_inr)} /><Row label="Verification" value={result.verification_source} /></>}</> : <EmptyDetail text="No recovery execution has been recorded." />}</Section>
    <Section title="Audit timeline" icon={<Clock3 className="h-4 w-4" />}>{audits.length ? <div className="space-y-3">{audits.map((a) => <div key={a.id} className="relative border-l border-slate-800 pl-4"><p className="text-xs font-medium text-slate-200">{a.action_type}</p><p className="mt-1 text-[11px] text-slate-500">{a.actor_type} · {new Date(a.created_at).toLocaleString()}</p></div>)}</div> : <div className="space-y-3"><Timeline label="Transaction ingested" date={tx.created_at} /><Timeline label={decision ? 'AI diagnosis recorded' : 'Awaiting AI diagnosis'} date={decision?.created_at ?? tx.updated_at} /><Timeline label={policy ? `Policy ${policy.decision}` : 'Awaiting policy evaluation'} date={policy?.evaluated_at ?? tx.updated_at} /><Timeline label={result ? `Outcome: ${result.outcome_status}` : 'No verified recovery outcome'} date={result?.verified_at ?? tx.updated_at} /></div>}</Section>
  </aside></div>;
}
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) { return <section className="border-b border-slate-800 py-5"><div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">{icon}{title}</div>{children}</section>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-600">{label}</p><p className="mt-1 truncate text-xs font-medium text-slate-200">{value}</p></div>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex flex-col gap-1 border-b border-slate-900 py-2 last:border-0 sm:flex-row sm:justify-between"><span className="text-xs text-slate-500">{label}</span><span className="max-w-[70%] text-right text-xs text-slate-200">{value}</span></div>; }
function State({ value }: { value: string }) { const v = value.toLowerCase(); const cls = v.includes('block') || v.includes('reject') || v.includes('fail') ? 'border-rose-900/60 bg-rose-950/30 text-rose-300' : v.includes('review') || v.includes('pending') || v.includes('human') ? 'border-amber-900/60 bg-amber-950/30 text-amber-300' : v.includes('recover') || v.includes('allow') || v.includes('success') ? 'border-emerald-900/60 bg-emerald-950/30 text-emerald-300' : 'border-slate-800 bg-slate-900 text-slate-400'; return <span className={`rounded-md border px-2 py-1 text-[10px] font-medium ${cls}`}>{value.replaceAll('_', ' ')}</span>; }
function EmptyDetail({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-slate-800 px-4 py-5 text-xs text-slate-600">{text}</div>; }
function Timeline({ label, date }: { label: string; date: string }) { return <div className="flex gap-3"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-600" /><div><p className="text-xs text-slate-300">{label}</p><p className="mt-1 text-[10px] text-slate-600">{new Date(date).toLocaleString()}</p></div></div>; }
