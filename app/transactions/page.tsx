import { inMemoryStore } from '@/lib/db/inMemoryStore';
import { ProfessionalTransactionTable } from '../../components/transactions/ProfessionalTransactionTable';
import Link from 'next/link';

interface PageProps { searchParams?: { lossType?: string } }
export default function TransactionsPage({ searchParams }: PageProps) {
  const transactions = inMemoryStore.getTransactions();
  return <div className="space-y-6"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs text-slate-500"><Link href="/" className="hover:text-slate-300">Dashboard</Link><span>/</span><span>Transactions</span></div><h1 className="text-2xl font-semibold text-white">Recovery transaction ledger</h1><p className="mt-1 text-xs text-slate-500">AI recommends. Deterministic policy governs. Verified outcomes are counted as recovered revenue.</p></div><span className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-mono text-slate-400">{transactions.length} records</span></div><ProfessionalTransactionTable transactions={transactions} initialLossType={searchParams?.lossType} /></div>;
}
