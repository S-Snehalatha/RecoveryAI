import fs from 'fs';
import path from 'path';
import {
  DatabaseState,
  Transaction,
  AIDecision,
  PolicyDecisionRecord,
  RecoveryAttempt,
  RecoveryResult,
  AuditLog,
  HumanReview,
  BatchRun,
  WebhookEvent,
} from '@/types';
import { generateSyntheticDataset } from '@/lib/synthetic/generator';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'demo_state.json');

export class InMemoryStore {
  private state: DatabaseState;

  constructor() { this.state = this.loadState(); }

  private loadState(): DatabaseState {
    try {
      if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) as DatabaseState;
    } catch { /* Fallback to fresh state */ }
    return this.initializeDefaultState();
  }

  private saveState(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) { console.error('Failed to persist demo state to disk:', err); }
  }

  public initializeDefaultState(): DatabaseState {
    const syntheticTxs = generateSyntheticDataset(120);
    const defaultState: DatabaseState = { transactions: syntheticTxs, ai_decisions: [], policy_decisions: [], recovery_attempts: [], recovery_results: [], audit_log: [], webhook_events: [], control_groups: [], batch_runs: [], human_reviews: [] };
    syntheticTxs.forEach((tx: Transaction) => {
      if (tx.demo_scenario === 'SUCCESSFUL_RECOVERY') {
        const aiId = `ai-${tx.id.slice(3)}`, polId = `pol-${tx.id.slice(3)}`, attId = `att-${tx.id.slice(3)}`, resId = `res-${tx.id.slice(3)}`;
        defaultState.ai_decisions.push({ id: aiId, transaction_id: tx.id, recommended_strategy: 'send_payment_link', confidence_score: 0.92, diagnosis_code: 'UPI_COLLECT_EXPIRED_RETRY_LINK', concise_rationale: 'Customer was active on checkout; high intent. Sending smart link with instant UPI deep-link.', suggested_delay_minutes: 0, suggested_discount_pct: 0, model_name: 'claude-3-5-sonnet-demo', latency_ms: 240, created_at: tx.created_at });
        defaultState.policy_decisions.push({ id: polId, transaction_id: tx.id, ai_decision_id: aiId, decision: 'ALLOW', approved_strategy: 'send_payment_link', matched_rules: ['POL-03: payment_link amount <= 25000 AND confidence >= 0.60'], violation_reasons: [], is_override_required: false, evaluated_at: tx.created_at });
        defaultState.recovery_attempts.push({ id: attId, transaction_id: tx.id, policy_decision_id: polId, execution_mode: 'DEMO_SIMULATION', strategy: 'send_payment_link', gateway_action_id: 'sim_plink_847192', gateway_status: 'paid', payment_url: 'https://rzp.io/i/sim_plink_847192', request_payload: { amount: tx.amount_in_inr, customer_id: tx.customer_id }, response_payload: { id: 'sim_plink_847192', status: 'paid' }, status: 'SUCCEEDED', executed_at: tx.created_at });
        defaultState.recovery_results.push({ id: resId, recovery_attempt_id: attId, transaction_id: tx.id, outcome_status: 'VERIFIED_RECOVERED', recovered_amount_in_inr: tx.amount_in_inr, gateway_payment_id: 'pay_sim_94827104', verification_source: 'SIMULATION_EVENT', verification_payload: { event: 'payment.captured', payment_id: 'pay_sim_94827104' }, verified_at: tx.created_at });
      }
      if (tx.demo_scenario === 'HIGH_VALUE_RECEIVABLE' || tx.demo_scenario === 'OVER_LIMIT_REVIEW' || tx.demo_scenario === 'LOW_CONFIDENCE_REVIEW') {
        defaultState.human_reviews.push({ id: `rev-${tx.id.slice(3)}`, transaction_id: tx.id, review_status: 'PENDING', trigger_reason: tx.demo_scenario === 'HIGH_VALUE_RECEIVABLE' ? 'B2B invoice > ₹50,000 policy threshold' : tx.demo_scenario === 'OVER_LIMIT_REVIEW' ? 'Amount exceeds automated threshold' : 'Confidence score below 0.60 threshold', created_at: tx.created_at });
      }
    });
    return defaultState;
  }

  public getTransactions(): Transaction[] { return [...this.state.transactions]; }
  public getTransactionById(id: string): Transaction | undefined { return this.state.transactions.find((t: Transaction) => t.id === id || t.original_reference_id === id); }
  public insertTransaction(tx: Transaction): Transaction { this.state.transactions.unshift(tx); this.saveState(); return tx; }
  public updateTransaction(id: string, updates: Partial<Transaction>): Transaction | undefined {
    const idx = this.state.transactions.findIndex((t: Transaction) => t.id === id); if (idx === -1) return undefined;
    this.state.transactions[idx] = { ...this.state.transactions[idx]!, ...updates, updated_at: new Date().toISOString() }; this.saveState(); return this.state.transactions[idx];
  }
  public getAIDecisions(txId?: string): AIDecision[] { return txId ? this.state.ai_decisions.filter((d) => d.transaction_id === txId) : [...this.state.ai_decisions]; }
  public insertAIDecision(decision: AIDecision): AIDecision { this.state.ai_decisions.unshift(decision); this.saveState(); return decision; }
  public getPolicyDecisions(txId?: string): PolicyDecisionRecord[] { return txId ? this.state.policy_decisions.filter((p) => p.transaction_id === txId) : [...this.state.policy_decisions]; }
  public insertPolicyDecision(decision: PolicyDecisionRecord): PolicyDecisionRecord { this.state.policy_decisions.unshift(decision); this.saveState(); return decision; }
  public getRecoveryAttempts(txId?: string): RecoveryAttempt[] { return txId ? this.state.recovery_attempts.filter((a) => a.transaction_id === txId) : [...this.state.recovery_attempts]; }
  public getRecoveryAttemptByGatewayActionId(id: string): RecoveryAttempt | undefined { return this.state.recovery_attempts.find((a) => a.gateway_action_id === id); }
  public insertRecoveryAttempt(attempt: RecoveryAttempt): RecoveryAttempt { this.state.recovery_attempts.unshift(attempt); this.saveState(); return attempt; }
  public getRecoveryResults(txId?: string): RecoveryResult[] { return txId ? this.state.recovery_results.filter((r) => r.transaction_id === txId) : [...this.state.recovery_results]; }
  public insertRecoveryResult(result: RecoveryResult): RecoveryResult { this.state.recovery_results.unshift(result); this.saveState(); return result; }
  public getAuditLogs(txId?: string): AuditLog[] { return txId ? this.state.audit_log.filter((l) => l.transaction_id === txId) : [...this.state.audit_log]; }
  public insertAuditLog(log: AuditLog): AuditLog { this.state.audit_log.unshift(log); this.saveState(); return log; }
  public getHumanReviews(status?: string): HumanReview[] { return status ? this.state.human_reviews.filter((r) => r.review_status === status) : [...this.state.human_reviews]; }
  public insertHumanReview(review: HumanReview): HumanReview { this.state.human_reviews.unshift(review); this.saveState(); return review; }
  public updateHumanReview(id: string, updates: Partial<HumanReview>): HumanReview | undefined {
    const idx = this.state.human_reviews.findIndex((r) => r.id === id); if (idx === -1) return undefined;
    this.state.human_reviews[idx] = { ...this.state.human_reviews[idx]!, ...updates, resolved_at: updates.review_status !== 'PENDING' ? new Date().toISOString() : undefined }; this.saveState(); return this.state.human_reviews[idx];
  }
  public getBatchRuns(): BatchRun[] { return [...this.state.batch_runs]; }
  public getBatchRunById(id: string): BatchRun | undefined { return this.state.batch_runs.find((batch) => batch.id === id); }
  public insertBatchRun(batch: BatchRun): BatchRun { this.state.batch_runs.unshift(batch); this.saveState(); return batch; }
  public updateBatchRun(id: string, updates: Partial<BatchRun>): BatchRun | undefined { const idx = this.state.batch_runs.findIndex((batch) => batch.id === id); if (idx === -1) return undefined; this.state.batch_runs[idx] = { ...this.state.batch_runs[idx]!, ...updates }; this.saveState(); return this.state.batch_runs[idx]; }
  public getWebhookEvents(): WebhookEvent[] { return [...this.state.webhook_events]; }
  public getWebhookEventByGatewayId(id: string): WebhookEvent | undefined { return this.state.webhook_events.find((e) => e.gateway_event_id === id); }
  public insertWebhookEvent(event: WebhookEvent): WebhookEvent { this.state.webhook_events.unshift(event); this.saveState(); return event; }
  public updateWebhookEvent(id: string, updates: Partial<WebhookEvent>): WebhookEvent | undefined { const idx = this.state.webhook_events.findIndex((e) => e.id === id); if (idx === -1) return undefined; this.state.webhook_events[idx] = { ...this.state.webhook_events[idx]!, ...updates }; this.saveState(); return this.state.webhook_events[idx]; }
  public reset(): DatabaseState { this.state = this.initializeDefaultState(); this.saveState(); return this.state; }
}

export const inMemoryStore = new InMemoryStore();
