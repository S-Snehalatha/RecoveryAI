import { inMemoryStore } from '@/lib/db/inMemoryStore';
import { HumanReview, Transaction } from '@/types';
import { Check, X, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function ReviewsPage() {
  const reviews = inMemoryStore.getHumanReviews();
  const transactions = inMemoryStore.getTransactions();

  const reviewItems = reviews.map((r: HumanReview) => {
    const tx = transactions.find((t: Transaction) => t.id === r.transaction_id);
    return {
      review: r,
      transaction: tx,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/" className="hover:text-slate-200">Dashboard</Link>
            <span>/</span>
            <span className="text-slate-200">Review Queue</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Human-in-the-Loop Review Cockpit</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Deterministic policy gates flagged {reviews.length} items requiring manual risk authorization before execution.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-3 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
            {reviews.filter((r) => r.review_status === 'PENDING').length} PENDING APPROVAL
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {reviewItems.map(({ review, transaction }) => {
          if (!transaction) return null;
          return (
            <div
              key={review.id}
              className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
            >
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    FLAGGED
                  </span>
                  <span className="font-mono text-xs font-semibold text-slate-200">
                    {transaction.original_reference_id}
                  </span>
                  <span className="text-xs text-slate-500">·</span>
                  <span className="text-xs text-slate-400 capitalize font-medium">
                    {transaction.loss_type.replace('_', ' ')}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    {transaction.customer_name}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {transaction.customer_email} · Method: {transaction.payment_method}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs text-amber-300/90 bg-amber-950/30 border border-amber-900/40 px-3 py-1.5 rounded-lg">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                  <span>Trigger Reason: {review.trigger_reason}</span>
                </div>
              </div>

              <div className="flex flex-col md:items-end justify-between gap-4 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-800">
                <div className="text-left md:text-right">
                  <span className="text-xs font-mono text-slate-500">EXPOSURE AMOUNT</span>
                  <p className="text-2xl font-bold font-mono text-slate-100">
                    ₹{transaction.amount_in_inr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled
                    title="Action enabled in Phase 9"
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold opacity-90 cursor-not-allowed flex items-center gap-1.5"
                  >
                    <Check className="h-3.5 w-3.5" /> Approve Action
                  </button>
                  <button
                    disabled
                    title="Action enabled in Phase 9"
                    className="px-3.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold opacity-90 cursor-not-allowed flex items-center gap-1.5"
                  >
                    <X className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}