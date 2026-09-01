import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildAuditLogEntry,
  recordAuditEvent,
  AUDIT_EVENT_TYPES,
  isValidAuditEventType,
  AuditEventInput,
} from '../src/lib/audit';
import { inMemoryStore } from '../src/lib/db/inMemoryStore';

const REQUIRED_EVENT_TYPES = [
  'TRANSACTION_RECEIVED',
  'AI_DIAGNOSIS',
  'AI_STRATEGY_RECOMMENDED',
  'POLICY_CHECK',
  'POLICY_ALLOWED',
  'POLICY_BLOCKED',
  'HUMAN_REVIEW_REQUIRED',
  'HUMAN_APPROVED',
  'HUMAN_REJECTED',
  'EXECUTION_STARTED',
  'EXECUTION_SUCCEEDED',
  'EXECUTION_FAILED',
  'WEBHOOK_RECEIVED',
  'RECOVERY_CONFIRMED',
  'RECOVERY_FAILED',
  'BATCH_STARTED',
  'BATCH_COMPLETED',
];

function baseInput(overrides: Partial<AuditEventInput> = {}): AuditEventInput {
  return {
    event_type: 'POLICY_ALLOWED',
    actor_type: 'POLICY_ENGINE',
    actor_id: 'policy-engine',
    what: 'Policy evaluated the AI recommendation',
    why: 'Amount and confidence were within automated thresholds',
    result: 'ALLOW',
    transaction_id: 'tx-0001',
    rule_id: 'PAYMENT_RETRY_LIMIT',
    action_taken: 'retry_payment',
    amount_in_inr: 2000,
    ...overrides,
  };
}

describe('RecoverAI — Audit Trail Service (Phase 5)', () => {
  beforeEach(() => {
    inMemoryStore.reset();
  });

  describe('Event type coverage', () => {
    it('defines exactly the 17 required audit event types, no more, no fewer', () => {
      expect(new Set(AUDIT_EVENT_TYPES)).toEqual(new Set(REQUIRED_EVENT_TYPES));
      expect(AUDIT_EVENT_TYPES.length).toBe(REQUIRED_EVENT_TYPES.length);
    });

    it('validates known event types and rejects unknown ones', () => {
      expect(isValidAuditEventType('POLICY_ALLOWED')).toBe(true);
      expect(isValidAuditEventType('SOMETHING_MADE_UP')).toBe(false);
    });
  });

  describe('buildAuditLogEntry — the eight-question contract', () => {
    it('captures WHO, WHAT, WHEN, WHY, WHICH RULE, WHICH ACTION, WHAT RESULT, HOW MUCH', () => {
      const entry = buildAuditLogEntry(baseInput(), { id: 'audit-fixed-1', nowIso: '2026-01-01T00:00:00.000Z' });

      expect(entry.id).toBe('audit-fixed-1');
      expect(entry.transaction_id).toBe('tx-0001');
      expect(entry.actor_type).toBe('POLICY_ENGINE'); // WHO (role)
      expect(entry.actor_id).toBe('policy-engine'); // WHO (identity)
      expect(entry.action_type).toBe('POLICY_ALLOWED');
      expect(entry.created_at).toBe('2026-01-01T00:00:00.000Z'); // WHEN

      const stateAfter = entry.state_after as Record<string, unknown>;
      expect(stateAfter.what).toBe('Policy evaluated the AI recommendation'); // WHAT
      expect(stateAfter.why).toBe('Amount and confidence were within automated thresholds'); // WHY
      expect(stateAfter.which_rule).toBe('PAYMENT_RETRY_LIMIT'); // WHICH RULE
      expect(stateAfter.which_action).toBe('retry_payment'); // WHICH ACTION
      expect(stateAfter.what_result).toBe('ALLOW'); // WHAT RESULT
      expect(stateAfter.how_much_inr).toBe(2000); // HOW MUCH
    });

    it('defaults which_rule, which_action, and how_much_inr to null when not applicable', () => {
      const entry = buildAuditLogEntry(
        baseInput({
          event_type: 'BATCH_STARTED',
          actor_type: 'SYSTEM',
          actor_id: 'batch-runner',
          rule_id: undefined,
          action_taken: undefined,
          amount_in_inr: undefined,
          transaction_id: undefined,
          result: 'STARTED',
        })
      );

      const stateAfter = entry.state_after as Record<string, unknown>;
      expect(stateAfter.which_rule).toBeNull();
      expect(stateAfter.which_action).toBeNull();
      expect(stateAfter.how_much_inr).toBeNull();
      expect(entry.transaction_id).toBeUndefined();
    });
  });

  describe('checksum_hash — tamper-evidence', () => {
    it('produces an identical hash for identical input', () => {
      const options = { id: 'audit-fixed-2', nowIso: '2026-01-01T00:00:00.000Z' };
      const first = buildAuditLogEntry(baseInput(), options);
      const second = buildAuditLogEntry(baseInput(), options);

      expect(first.checksum_hash).toBe(second.checksum_hash);
    });

    it('produces a different hash when any material field changes', () => {
      const options = { id: 'audit-fixed-3', nowIso: '2026-01-01T00:00:00.000Z' };
      const original = buildAuditLogEntry(baseInput(), options);
      const changedResult = buildAuditLogEntry(baseInput({ result: 'BLOCK' }), options);
      const changedAmount = buildAuditLogEntry(baseInput({ amount_in_inr: 999999 }), options);

      expect(original.checksum_hash).not.toBe(changedResult.checksum_hash);
      expect(original.checksum_hash).not.toBe(changedAmount.checksum_hash);
    });
  });

  describe('recordAuditEvent — persistence', () => {
    it('persists the audit entry to the store and it is retrievable by transaction id', () => {
      const recorded = recordAuditEvent(baseInput({ transaction_id: 'tx-persist-1' }));

      const stored = inMemoryStore.getAuditLogs('tx-persist-1');
      expect(stored.length).toBe(1);
      expect(stored[0]?.id).toBe(recorded.id);
      expect(stored[0]?.checksum_hash).toBe(recorded.checksum_hash);
    });
  });
});
