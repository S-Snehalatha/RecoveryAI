import { inMemoryStore } from '@/lib/db/inMemoryStore';
import { TransactionTableClient } from '@/components/transactions/TransactionTableClient';
import Link from 'next/link';

interface PageProps {
  searchParams?: {
    lossType?: string;
    scenario?: string;
  };
}

export default function TransactionsPage({ searchParams }: PageProps) {
  const allTxs = inMemoryStore.getTransactions();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/" className="hover:text-slate-200">Dashboard</Link>
            <span>/</span>
            <span className="text-slate-200">Transactions Ledger</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">At-Risk Transactions & AI Engine</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Interactive diagnostic workbench. Click <span className="text-sky-400 font-semibold font-mono">Run AI Diagnosis</span> on any transaction to run real-time diagnosis.
          </p>
        </div>
      </div>

      <TransactionTableClient
        initialTransactions={allTxs}
        initialLossType={searchParams?.lossType}
        initialScenario={searchParams?.scenario}
      />
    </div>
  );
}