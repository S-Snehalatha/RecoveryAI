import { inMemoryStore } from '@/lib/db/inMemoryStore';
import { ReviewQueueClient } from '@/components/reviews/ReviewQueueClient';
import { HumanReview, Transaction } from '@/types';

export default function ReviewsPage() {
  const reviews = inMemoryStore.getHumanReviews();
  const transactions = inMemoryStore.getTransactions();

  const items = reviews
    .map((review: HumanReview) => {
      const transaction = transactions.find((tx: Transaction) => tx.id === review.transaction_id);
      if (!transaction) return null;
      return {
        review,
        transaction,
        decision: inMemoryStore.getAIDecisions(transaction.id)[0] ?? null,
        policy: inMemoryStore.getPolicyDecisions(transaction.id)[0] ?? null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const pending = reviews.filter((review) => review.review_status === 'PENDING').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 text-xs text-slate-500">Dashboard / Agent Approval Queue</div>
          <h1 className="text-2xl font-semibold text-white">RecoverAI Agent Approval Queue</h1>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
            The agent investigates the revenue risk and recommends the recovery action. Financial execution stays paused until a human explicitly approves it.
          </p>
        </div>
        <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-mono text-amber-300">
          {pending} PENDING APPROVAL
        </span>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
        <strong className="text-slate-200">Safety rule:</strong> Human approval does not override deterministic policy. The server performs a fresh policy check immediately before execution.
      </div>

      <ReviewQueueClient items={items} />
    </div>
  );
}
