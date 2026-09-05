'use client';

import { useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { HumanReview, Transaction, AIDecision, PolicyDecisionRecord } from '@/types';

interface ReviewItem {
  review: HumanReview;
  transaction: Transaction;
  decision: AIDecision | null;
  policy: PolicyDecisionRecord | null;
}

interface ReviewQueueClientProps {
  items: ReviewItem[];
}

const strategyLabels: Record<string, string> = {
  retry_payment: 'Retry Payment',
  send_payment_link: 'Payment Link',
  retry_mandate: 'Retry Mandate',
  escalate_receivables: 'Escalate Receivables',
  human_review: 'Human Review',
  no_action: 'No Action',
};

export function ReviewQueueClient({ items }: ReviewQueueClientProps) {
  const [rows, setRows] = useState(items);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function decide(item: ReviewItem, approved: boolean) {
    setBusyId(item.review.id);
    setMessage(null);
    try {
      const response = await fetch('/api/agent/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: item.transaction.id,
          reviewId: item.review.id,
          approved,
          reviewerId: 'dashboard-operator',
        }),
      });
      const payload = (await response.json()) as { error?: string; status?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Approval request failed.');

      setRows((current) => current.map((row) =>
        row.review.id === item.review.id
          ? { ...row, review: { ...row.review, review_status: approved ? 'APPROVED' : 'REJECTED' } }
          : row,
      ));
      setMessage(approved ? 'Approved. The agent was authorized to execute the recommended recovery.' : 'Rejected. The recovery action was stopped.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Approval request failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {message && <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs text-slate-300">{message}</div>}
      {rows.map((item) => {
        const pending = item.review.review_status === 'PENDING';
        return (
          <div key={item.review.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-300">
                    {item.review.review_status === 'PENDING' ? 'AWAITING APPROVAL' : item.review.review_status}
                  </span>
                  <span className="font-mono text-xs text-slate-200">{item.transaction.original_reference_id}</span>
                  <span className="text-xs text-slate-500">·</span>
                  <span className="text-xs text-slate-400">{item.transaction.loss_type.replaceAll('_', ' ')}</span>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-white">{item.transaction.customer_name}</h3>
                  <p className="mt-1 text-xs text-slate-500">{item.transaction.customer_email} · {item.transaction.payment_method}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Info label="Revenue at risk" value={`₹${item.transaction.amount_in_inr.toLocaleString('en-IN')}`} />
                  <Info label="What happened" value={item.decision?.diagnosis_code ?? 'Analysis pending'} />
                  <Info label="Recommended" value={strategyLabels[item.decision?.recommended_strategy ?? ''] ?? item.decision?.recommended_strategy ?? '—'} />
                  <Info label="Confidence" value={item.decision ? `${Math.round(item.decision.confidence_score * 100)}%` : '—'} />
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300">
                  <p><span className="text-slate-500">Agent reasoning:</span> {item.decision?.concise_rationale ?? item.review.trigger_reason}</p>
                  <p className="mt-2"><span className="text-slate-500">Policy:</span> {item.policy?.decision ?? '—'} · {item.policy?.matched_rules?.join(', ') ?? '—'}</p>
                  <p className="mt-2"><span className="text-slate-500">Human gate:</span> {pending ? 'Required before execution' : item.review.review_status}</p>
                </div>
              </div>

              <div className="flex shrink-0 gap-2 lg:pt-8">
                <button
                  type="button"
                  disabled={!pending || busyId === item.review.id}
                  onClick={() => decide(item, true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busyId === item.review.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Approve & Execute
                </button>
                <button
                  type="button"
                  disabled={!pending || busyId === item.review.id}
                  onClick={() => decide(item, false)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/15 px-3.5 py-2 text-xs font-semibold text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <X className="h-3.5 w-3.5" /> Reject
                </button>
              </div>
            </div>
          </div>
        );
      })}
      {!rows.length && <div className="rounded-xl border border-dashed border-slate-800 px-6 py-12 text-center text-xs text-slate-500">No agent approvals are waiting.</div>}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-600">{label}</p><p className="mt-1 break-words text-xs font-medium text-slate-200">{value}</p></div>;
}
