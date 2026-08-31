import { inMemoryStore } from '@/lib/db/inMemoryStore';
import { Transaction } from '@/types';
import Link from 'next/link';

interface PageProps {
  searchParams?: {
    lossType?: string;
    scenario?: string;
  };
}

export default function TransactionsPage({ searchParams }: PageProps) {
  const allTxs = inMemoryStore.getTransactions();

  const selectedLossType = searchParams?.lossType;
  const selectedScenario = searchParams?.scenario;

  const filteredTxs = allTxs.filter((t: Transaction) => {
    if (selectedLossType && t.loss_type !== selectedLossType) return false;
    if (selectedScenario && t.demo_scenario !== selectedScenario) return false;
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RECOVERED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">RECOVERED</span>;
      case 'POLICY_APPROVED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-sky-500/15 text-sky-400 border border-sky-500/30">POLICY_APPROVED</span>;
      case 'NEEDS_HUMAN_REVIEW':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-amber-500/15 text-amber-400 border border-amber-500/30">NEEDS_REVIEW</span>;
      case 'REJECTED_BY_POLICY':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-rose-500/15 text-rose-400 border border-rose-500/30">BLOCKED</span>;
      case 'RECOVERY_FAILED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-slate-500/15 text-slate-400 border border-slate-500/30">FAILED</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/" className="hover:text-slate-200">Dashboard</Link>
            <span>/</span>
            <span className="text-slate-200">Transactions Ledger</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">At-Risk Transactions Ledger</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Showing {filteredTxs.length} of {allTxs.length} synthetic records
            {selectedLossType && <span className="text-sky-400 font-mono ml-1">· Filter: {selectedLossType}</span>}
            {selectedScenario && <span className="text-amber-400 font-mono ml-1">· Scenario: {selectedScenario}</span>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(selectedLossType || selectedScenario) && (
            <Link
              href="/transactions"
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs text-slate-300 hover:bg-slate-700"
            >
              Clear Filters
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800 text-xs">
        <Link
          href="/transactions"
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            !selectedLossType && !selectedScenario ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          All (120)
        </Link>
        <Link
          href="/transactions?lossType=failed_payment"
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            selectedLossType === 'failed_payment' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          Failed Payment (31)
        </Link>
        <Link
          href="/transactions?lossType=abandoned_checkout"
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            selectedLossType === 'abandoned_checkout' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          Abandoned Checkout (30)
        </Link>
        <Link
          href="/transactions?lossType=subscription_failure"
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            selectedLossType === 'subscription_failure' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          Subscription Failure (30)
        </Link>
        <Link
          href="/transactions?lossType=overdue_receivable"
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            selectedLossType === 'overdue_receivable' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          Overdue Receivable (29)
        </Link>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-mono uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Reference ID</th>
                <th className="py-3.5 px-4 font-semibold">Customer / Company</th>
                <th className="py-3.5 px-4 font-semibold">Loss Type</th>
                <th className="py-3.5 px-4 font-semibold">Amount</th>
                <th className="py-3.5 px-4 font-semibold">Method</th>
                <th className="py-3.5 px-4 font-semibold">Scenario</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredTxs.map((tx: Transaction) => (
                <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 font-mono font-medium text-slate-200">
                    {tx.original_reference_id}
                    <div className="text-[10px] text-slate-500">Group: {tx.experiment_group === 'AI_RECOVERY_GROUP' ? 'AI Group' : 'Control'}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-100">{tx.customer_name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{tx.customer_email}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-[11px] font-mono capitalize text-slate-300">
                      {tx.loss_type.replace('_', ' ')}
                    </span>
                    {tx.gateway_error_code && (
                      <div className="text-[10px] text-slate-500 font-mono truncate max-w-[140px]" title={tx.gateway_error_code}>
                        {tx.gateway_error_code}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-slate-100">
                    ₹{tx.amount_in_inr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-400 capitalize">
                    {tx.payment_method.replace('_', ' ')}
                  </td>
                  <td className="py-3 px-4">
                    {tx.demo_scenario && tx.demo_scenario !== 'STANDARD_STREAM' ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        {tx.demo_scenario}
                      </span>
                    ) : (
                      <span className="text-slate-600 font-mono text-[11px]">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {getStatusBadge(tx.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}