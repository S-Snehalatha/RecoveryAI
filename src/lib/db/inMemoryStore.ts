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
} from '@/types';
import { generateSyntheticDataset } from '@/lib/synthetic/generator';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'demo_state.json');

export class InMemoryStore {
  private state: DatabaseState;

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): DatabaseState {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(raw) as DatabaseState;
      }
    } catch {
      // Fallback to fresh state
    }
    return this.initializeDefaultState();
  }

  private saveState(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist demo state to disk:', err);
    }
  }

  public initializeDefaultState(): DatabaseState {
    const syntheticTxs = generateSyntheticDataset(120);

    const defaultState: DatabaseState = {
      transactions: syntheticTxs,
      ai_decisions: [],
      policy_decisions: [],
      recovery_attempts: [],
      recovery_results: [],
      audit_log: [],
      webhook_events: [],
      control_groups: [],
      batch_runs: [],
      human_reviews: [],
    };

    // Pre-populate related records for deterministic scenarios
    syntheticTxs.forEach((tx: Transaction) => {
      if (tx.demo_scenario === 'SUCCESSFUL_RECOVERY') {
        const aiId = `ai-${tx.id.slice(3)}`;
        const polId = `pol-${tx.id.slice(3)}`;
        const attId = `att-${tx.id.slice(3)}`;
        const resId = `res-${tx.id.slice(3)}`;

        defaultState.ai_decisions.push({
          id: aiId,
          transaction_id: tx.id,
          recommended_strategy: 'send_payment_link',
          confidence_score: 0.92,
          diagnosis_code: 'UPI_COLLECT_EXPIRED_RETRY_LINK',
          concise_rationale: 'Customer was active on checkout; high intent. Sending smart link with instant UPI deep-link.',
          suggested_delay_minutes: 0,
          suggested_discount_pct: 0,
          model_name: 'claude-3-5-sonnet-demo',
          latency_ms: 240,
          created_at: tx.created_at,
        });

        defaultState.policy_decisions.push({
          id: polId,
          transaction_id: tx.id,
          ai_decision_id: aiId,
          decision: 'ALLOW',
          approved_strategy: 'send_payment_link',
          matched_rules: ['POL-03: payment_link amount <= 25000 AND confidence >= 0.60'],
          violation_reasons: [],
          is_override_required: false,
          evaluated_at: tx.created_at,
        });

        defaultState.recovery_attempts.push({
          id: attId,
          transaction_id: tx.id,
          policy_decision_id: polId,
          execution_mode: 'DEMO_SIMULATION',
          strategy: 'send_payment_link',
          gateway_action_id: 'sim_plink_847192',
          gateway_status: 'paid',
          payment_url: 'https://rzp.io/i/sim_plink_847192',
          request_payload: { amount: tx.amount_in_inr, customer_id: tx.customer_id },
          response_payload: { id: 'sim_plink_847192', status: 'paid' },
          status: 'SUCCEEDED',
          executed_at: tx.created_at,
        });

        defaultState.recovery_results.push({
          id: resId,
          recovery_attempt_id: attId,
          transaction_id: tx.id,
          outcome_status: 'VERIFIED_RECOVERED',
          recovered_amount_in_inr: tx.amount_in_inr,
          gateway_payment_id: 'pay_sim_94827104',
          verification_source: 'WEBHOOK_SIGNATURE',
          verification_payload: { event: 'payment.captured', payment_id: 'pay_sim_94827104' },
          verified_at: tx.created_at,
        });
      }

      if (tx.demo_scenario === 'HIGH_VALUE_RECEIVABLE' || tx.demo_scenario === 'OVER_LIMIT_REVIEW' || tx.demo_scenario === 'LOW_CONFIDENCE_REVIEW') {
        defaultState.human_reviews.push({
          id: `rev-${tx.id.slice(3)}`,
          transaction_id: tx.id,
          review_status: 'PENDING',
          trigger_reason: tx.demo_scenario === 'HIGH_VALUE_RECEIVABLE'
            ? 'B2B invoice > ₹50,000 policy threshold'
            : tx.demo_scenario === 'OVER_LIMIT_REVIEW'
            ? 'Amount exceeds automated threshold'
            : 'Confidence score below 0.60 threshold',
          created_at: tx.created_at,
        });
      }
    });

    return defaultState;
  }

  // Transactions
  public getTransactions(): Transaction[] {
    return [...this.state.transactions];
  }

  public getTransactionById(id: string): Transaction | undefined {
    return this.state.transactions.find((t: Transaction) => t.id === id || t.original_reference_id === id);
  }

  public insertTransaction(tx: Transaction): Transaction {
    this.state.transactions.unshift(tx);
    this.saveState();
    return tx;
  }

  public updateTransaction(id: string, updates: Partial<Transaction>): Transaction | undefined {
    const idx = this.state.transactions.findIndex((t: Transaction) => t.id === id);
    if (idx === -1) return undefined;
    this.state.transactions[idx] = {
      ...this.state.transactions[idx]!,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.saveState();
    return this.state.transactions[idx];
  }

  // AI Decisions
  public getAIDecisions(txId?: string): AIDecision[] {
    if (!txId) return [...this.state.ai_decisions];
    return this.state.ai_decisions.filter((d: AIDecision) => d.transaction_id === txId);
  }

  public insertAIDecision(decision: AIDecision): AIDecision {
    this.state.ai_decisions.unshift(decision);
    this.saveState();
    return decision;
  }

  // Policy Decisions
  public getPolicyDecisions(txId?: string): PolicyDecisionRecord[] {
    if (!txId) return [...this.state.policy_decisions];
    return this.state.policy_decisions.filter((p: PolicyDecisionRecord) => p.transaction_id === txId);
  }

  public insertPolicyDecision(decision: PolicyDecisionRecord): PolicyDecisionRecord {
    this.state.policy_decisions.unshift(decision);
    this.saveState();
    return decision;
  }

  // Recovery Attempts
  public getRecoveryAttempts(txId?: string): RecoveryAttempt[] {
    if (!txId) return [...this.state.recovery_attempts];
    return this.state.recovery_attempts.filter((a: RecoveryAttempt) => a.transaction_id === txId);
  }

  public insertRecoveryAttempt(attempt: RecoveryAttempt): RecoveryAttempt {
    this.state.recovery_attempts.unshift(attempt);
    this.saveState();
    return attempt;
  }

  // Recovery Results
  public getRecoveryResults(txId?: string): RecoveryResult[] {
    if (!txId) return [...this.state.recovery_results];
    return this.state.recovery_results.filter((r: RecoveryResult) => r.transaction_id === txId);
  }

  public insertRecoveryResult(result: RecoveryResult): RecoveryResult {
    this.state.recovery_results.unshift(result);
    this.saveState();
    return result;
  }

  // Audit Logs
  public getAuditLogs(txId?: string): AuditLog[] {
    if (!txId) return [...this.state.audit_log];
    return this.state.audit_log.filter((l: AuditLog) => l.transaction_id === txId);
  }

  public insertAuditLog(log: AuditLog): AuditLog {
    this.state.audit_log.unshift(log);
    this.saveState();
    return log;
  }

  // Human Reviews
  public getHumanReviews(status?: string): HumanReview[] {
    if (!status) return [...this.state.human_reviews];
    return this.state.human_reviews.filter((r: HumanReview) => r.review_status === status);
  }

  public insertHumanReview(review: HumanReview): HumanReview {
    this.state.human_reviews.unshift(review);
    this.saveState();
    return review;
  }

  public updateHumanReview(id: string, updates: Partial<HumanReview>): HumanReview | undefined {
    const idx = this.state.human_reviews.findIndex((r: HumanReview) => r.id === id);
    if (idx === -1) return undefined;
    this.state.human_reviews[idx] = {
      ...this.state.human_reviews[idx]!,
      ...updates,
      resolved_at: updates.review_status !== 'PENDING' ? new Date().toISOString() : undefined,
    };
    this.saveState();
    return this.state.human_reviews[idx];
  }

  // Batch Runs
  public getBatchRuns(): BatchRun[] {
    return [...this.state.batch_runs];
  }

  public getBatchRunById(id: string): BatchRun | undefined {
    return this.state.batch_runs.find((batch: BatchRun) => batch.id === id);
  }

  public insertBatchRun(batch: BatchRun): BatchRun {
    this.state.batch_runs.unshift(batch);
    this.saveState();
    return batch;
  }

  public updateBatchRun(id: string, updates: Partial<BatchRun>): BatchRun | undefined {
    const idx = this.state.batch_runs.findIndex((batch: BatchRun) => batch.id === id);
    if (idx === -1) return undefined;
    this.state.batch_runs[idx] = {
      ...this.state.batch_runs[idx]!,
      ...updates,
    };
    this.saveState();
    return this.state.batch_runs[idx];
  }

  // Reset Demo State
  public reset(): DatabaseState {
    this.state = this.initializeDefaultState();
    this.saveState();
    return this.state;
  }
}

export const inMemoryStore = new InMemoryStore();