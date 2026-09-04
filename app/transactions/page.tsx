import { inMemoryStore } from '@/lib/db/inMemoryStore';
import { TransactionTableClient } from '@/components/transactions/TransactionTableClient';
import Link from 'next/link';

interface PageProps { searchParams?: { lossType?: string; scenario?: string } }

export default function TransactionsPage({ searchParams }: PageProps) {
  const allTxs = inMemoryStore.getTransactions();
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="flex items-center gap-2 text-xs text-slate-500 mb-2"><Link href="/" className="hover:text-slate-300">Dashboard</Link><span>/</span><span>Transactions</span></div><h1 className="text-2xl font-semibold text-white">Recovery transaction ledger</h1><p className="mt-1 text-xs text-slate-500">AI recommendations are advisory; deterministic policy decisions govern execution.</p></div>
        <span className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-mono text-slate-400">{allTxs.length} records</span>
      </div>
      <TransactionTableClient initialTransactions={allTxs} initialLossType={searchParams?.lossType} initialScenario={searchParams?.scenario} />
    </div>
  );
}
