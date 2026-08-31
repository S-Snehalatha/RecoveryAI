import { inMemoryStore } from '../src/lib/db/inMemoryStore';
import { LossType, DemoScenario, Transaction } from '../src/types';

async function runSeed() {
  console.log('🌱 Starting RecoverAI Deterministic Data Seeding...');

  const state = inMemoryStore.reset();
  const txs: Transaction[] = state.transactions;

  console.log(`✅ Seeded ${txs.length} synthetic transactions successfully.`);

  // Validate loss type distribution
  const lossCounts: Record<LossType, number> = {
    failed_payment: 0,
    abandoned_checkout: 0,
    subscription_failure: 0,
    overdue_receivable: 0,
  };

  let totalRevenueAtRisk = 0;

  txs.forEach((t: Transaction) => {
    lossCounts[t.loss_type] = (lossCounts[t.loss_type] || 0) + 1;
    totalRevenueAtRisk += t.amount_in_inr;
  });

  console.log('\n📊 Loss Type Distribution:');
  console.table(
    Object.entries(lossCounts).map(([lossType, count]) => ({
      'Loss Type': lossType,
      'Count': count,
      'Percentage': `${((count / txs.length) * 100).toFixed(1)}%`,
    }))
  );

  // Validate Demo Scenarios
  console.log('\n🎯 Deterministic Demo Scenarios Validated:');
  const REQUIRED_SCENARIOS: DemoScenario[] = [
    'SAFE_AUTO_RETRY',
    'OVER_LIMIT_REVIEW',
    'LOW_CONFIDENCE_REVIEW',
    'PAYMENT_LINK_RECOVERY',
    'SUBSCRIPTION_REVIEW',
    'HIGH_VALUE_RECEIVABLE',
    'BLOCKED_ACTION',
    'SUCCESSFUL_RECOVERY',
    'FAILED_RECOVERY',
  ];

  const scenarioReport = REQUIRED_SCENARIOS.map((sc) => {
    const matchingTx = txs.find((t: Transaction) => t.demo_scenario === sc);
    return {
      'Scenario': sc,
      'Status': matchingTx ? '✅ PRESENT' : '❌ MISSING',
      'Sample ID': matchingTx?.id || 'N/A',
      'Sample Amount': matchingTx ? `₹${matchingTx.amount_in_inr.toLocaleString('en-IN')}` : 'N/A',
      'Loss Type': matchingTx?.loss_type || 'N/A',
    };
  });

  console.table(scenarioReport);

  console.log(`\n💰 Total Revenue at Risk Seeded: ₹${totalRevenueAtRisk.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
  console.log(`🔒 Pre-populated AI Decisions: ${state.ai_decisions.length}`);
  console.log(`⚖️ Pre-populated Policy Decisions: ${state.policy_decisions.length}`);
  console.log(`🚀 Pre-populated Recovery Attempts: ${state.recovery_attempts.length}`);
  console.log(`💵 Pre-populated Recovery Results: ${state.recovery_results.length}`);
  console.log(`👤 Pre-populated Human Review Items: ${state.human_reviews.length}`);
  console.log('\n✨ Database seeding completed successfully.');
}

runSeed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});