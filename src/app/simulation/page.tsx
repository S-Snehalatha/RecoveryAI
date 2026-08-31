import { inMemoryStore } from '@/lib/db/inMemoryStore';
import { Transaction } from '@/types';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function SimulationPage() {
  const transactions = inMemoryStore.getTransactions();

  const scenarios = [
    { code: 'SAFE_AUTO_RETRY', title: '1. Safe Micro-Retry', desc: 'Amount ≤ ₹5,000, attempt count ≤ 2, high trust history' },
    { code: 'OVER_LIMIT_REVIEW', title: '2. High-Value Payment Link', desc: 'Amount > ₹25,000, requires human approval before link dispatch' },
    { code: 'LOW_CONFIDENCE_REVIEW', title: '3. Low Confidence (<0.60)', desc: 'Ambiguous cart drop-off anomaly flagged for operator check' },
    { code: 'PAYMENT_LINK_RECOVERY', title: '4. Dynamic Payment Link', desc: 'Abandoned checkout converted to smart UPI link' },
    { code: 'SUBSCRIPTION_REVIEW', title: '5. Mandate Failure Review', desc: 'NACH debit rejected with <3 successful payment history' },
    { code: 'HIGH_VALUE_RECEIVABLE', title: '6. High Value B2B Receivable', desc: 'Enterprise invoice > ₹50,000 routed to account manager' },
    { code: 'BLOCKED_ACTION', title: '7. Policy Blocked Action', desc: 'Exceeded 3 retry attempts; blocked from auto-charge' },
    { code: 'SUCCESSFUL_RECOVERY', title: '8. Verified Gateway Outcome', desc: 'Payment link paid and verified via payment.captured webhook' },
    { code: 'FAILED_RECOVERY', title: '9. Definitive Failure Outcome', desc: 'Customer bank rejected mandate retry permanently' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/" className="hover:text-slate-200">Dashboard</Link>
            <span>/</span>
            <span className="text-slate-200">Simulation Controls</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Demo Simulation Controller</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Test and inspect all 9 deterministic scenarios with zero external credentials required.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/transactions"
            className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition-all shadow-md shadow-sky-500/20 flex items-center gap-1.5"
          >
            Explore 120 Transactions <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {scenarios.map((sc) => {
          const matchingTx = transactions.find((t: Transaction) => t.demo_scenario === sc.code);
          return (
            <div
              key={sc.code}
              className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-sky-400 border border-slate-700">
                    {sc.code}
                  </span>
                  {matchingTx && (
                    <span className="text-xs font-mono font-semibold text-slate-200">
                      ₹{matchingTx.amount_in_inr.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-slate-100 mt-2">{sc.title}</h3>
                <p className="text-xs text-slate-400 mt-1">{sc.desc}</p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <Link
                  href={`/transactions?scenario=${sc.code}`}
                  className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1"
                >
                  View In Ledger →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}