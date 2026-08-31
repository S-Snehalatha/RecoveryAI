import { inMemoryStore } from '../src/lib/db/inMemoryStore';

async function resetDemo() {
  console.log('🔄 Resetting RecoverAI Demo State...');
  const state = inMemoryStore.reset();
  console.log(`✅ Demo state reset cleanly to ${state.transactions.length} synthetic records.`);
}

resetDemo().catch((err) => {
  console.error('❌ Reset demo failed:', err);
  process.exit(1);
});
