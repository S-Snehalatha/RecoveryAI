import Link from 'next/link';
import { inMemoryStore } from '@/lib/db/inMemoryStore';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Zap,
  FileSpreadsheet,
} from 'lucide-react';

export default function HomePage() {
  const transactions = inMemoryStore.getTransactions();
  const humanReviews = inMemoryStore.getHumanReviews();
  const recoveryResults = inMemoryStore.getRecoveryResults();

  const totalAtRisk = transactions.reduce((acc, t) => acc + t.amount_in_inr, 0);
  const recoveredAmount = recoveryResults.reduce((acc, r) => acc + r.recovered_amount_in_inr, 0);
  const pendingReviews = humanReviews.filter((r) => r.review_status === 'PENDING').length;

  const lossBreakdown = {
    failed_payment: transactions.filter((t) => t.loss_type === 'failed_payment'),
    abandoned_checkout: transactions.filter((t) => t.loss_type === 'abandoned_checkout'),
    subscription_failure: transactions.filter((t) => t.loss_type === 'subscription_failure'),
    overdue_receivable: transactions.filter((t) => t.loss_type === 'overdue_receivable'),
  };

  const scenarios = [
    { code: 'SAFE_AUTO_RETRY', title: 'Safe Micro Retry', desc: '≤ ₹5,000 card retry within safety bounds' },
    { code: 'OVER_LIMIT_REVIEW', title: 'High-Value Payment Link', desc: '> ₹25,000 requiring human approval' },
    { code: 'LOW_CONFIDENCE_REVIEW', title: 'Low AI Confidence', desc: 'Anomaly detected; confidence < 0.60' },
    { code: 'PAYMENT_LINK_RECOVERY', title: 'Smart Link Recovery', desc: 'Instant UPI/Card link for abandoned cart' },
    { code: 'SUBSCRIPTION_REVIEW', title: 'Mandate Recovery', desc: 'e-Mandate renewal review (<3 history)' },
    { code: 'HIGH_VALUE_RECEIVABLE', title: 'B2B Receivable', desc: 'Enterprise invoice > ₹50,000' },
    { code: 'BLOCKED_ACTION', title: 'Blocked by Policy', desc: 'Exceeded max retry threshold (4 attempts)' },
    { code: 'SUCCESSFUL_RECOVERY', title: 'Verified Recovery', desc: 'Webhook confirmed payment.captured' },
    { code: 'FAILED_RECOVERY', title: 'Definitive Failure', desc: 'Mandate revoked by customer bank' },
  ];

  return (
    <div className="space-y-8">
      {/* Hero Welcome & Quick Stats */}
      <div className="p-6 md:p-8 rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-xs font-mono text-sky-400 mb-3">
              <Zap className="h-3.5 w-3.5" /> Razorpay AI Buildathon 2026 · Track 03
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              AI Revenue Recovery Cockpit
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Autonomous diagnosis, deterministic policy gates, and cryptographically verified gateway recovery outcomes.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/transactions"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-sm transition-all shadow-lg shadow-sky-500/20"
            >
              <FileSpreadsheet className="h-4 w-4" />
              View 120 Transactions
            </Link>
            <Link
              href="/simulation"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-all"
            >
              Demo Controls
            </Link>
          </div>
        </div>

        {/* Top 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/50">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>REVENUE AT RISK</span>
              <AlertTriangle className="h-4 w-4 text-rose-400" />
            </div>
            <p className="text-2xl font-bold text-slate-100 mt-2 font-mono">
              ₹{totalAtRisk.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-slate-500 mt-1">Across 120 synthetic transactions</p>
          </div>

          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/50">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>VERIFIED RECOVERED</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-emerald-400 mt-2 font-mono">
              ₹{recoveredAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-emerald-500/80 mt-1">Verified gateway webhooks</p>
          </div>

          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/50">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>HUMAN REVIEWS PENDING</span>
              <Clock className="h-4 w-4 text-amber-400" />
            </div>
            <p className="text-2xl font-bold text-amber-400 mt-2 font-mono">
              {pendingReviews}
            </p>
            <p className="text-xs text-slate-500 mt-1">High-value / low-confidence gates</p>
          </div>

          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/50">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>SAFETY GOVERNANCE</span>
              <ShieldCheck className="h-4 w-4 text-sky-400" />
            </div>
            <p className="text-2xl font-bold text-sky-400 mt-2 font-mono">
              100% Policy
            </p>
            <p className="text-xs text-slate-500 mt-1">Zero unverified AI direct charges</p>
          </div>
        </div>
      </div>

      {/* 4 Loss Types Breakdown */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-200">Four Target Loss Categories</h2>
          <Link href="/transactions" className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium">
            Explore All <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(lossBreakdown).map(([lossType, txs]) => {
            const amount = txs.reduce((acc, t) => acc + t.amount_in_inr, 0);
            const labels: Record<string, string> = {
              failed_payment: 'Failed Payment',
              abandoned_checkout: 'Abandoned Checkout',
              subscription_failure: 'Subscription Failure',
              overdue_receivable: 'Overdue Receivable',
            };
            return (
              <Link
                key={lossType}
                href={`/transactions?lossType=${lossType}`}
                className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900 hover:border-slate-700 transition-all group"
              >
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  {labels[lossType]}
                </span>
                <p className="text-xl font-bold text-slate-100 mt-2 font-mono">
                  ₹{amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
                <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                  <span>{txs.length} Transactions</span>
                  <span className="text-sky-400 group-hover:translate-x-1 transition-transform font-medium">
                    Filter →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 9 Deterministic Scenarios Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-200">Deterministic Demo Scenarios</h2>
            <p className="text-xs text-slate-400">Click any scenario to inspect its exact live transaction and policy trail.</p>
          </div>
          <Link href="/simulation" className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium">
            Simulation Controller <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {scenarios.map((sc) => {
            const matchingTx = transactions.find((t) => t.demo_scenario === sc.code);
            return (
              <Link
                key={sc.code}
                href={`/transactions?scenario=${sc.code}`}
                className="p-4 rounded-xl border border-slate-800 bg-slate-900/30 hover:bg-slate-800/50 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {sc.code}
                    </span>
                    {matchingTx && (
                      <span className="text-xs font-mono font-bold text-slate-200">
                        ₹{matchingTx.amount_in_inr.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-slate-100 mt-2">{sc.title}</h3>
                  <p className="text-xs text-slate-400 mt-1">{sc.desc}</p>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                  <span>ID: {matchingTx?.original_reference_id || 'Seeded'}</span>
                  <span className="text-sky-400 font-medium">Inspect Record →</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}