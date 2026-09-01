import { createHash, randomUUID } from 'crypto';
import { ActorType, AuditLog } from '@/types';
import { inMemoryStore } from '@/lib/db/inMemoryStore';

/**
 * RecoverAI Audit Trail Service (Phase 5)
 * ----------------------------------------
 * Every financially-relevant thing the system does — an AI diagnosis, a
 * policy check, a human decision, a gateway execution, a webhook
 * confirmation — is recorded here as an immutable, hash-stamped audit
 * event. This module has no opinion about WHERE those decisions come
 * from; it only guarantees that whoever calls it produces a complete,
 * self-describing record.
 */

/** The fixed set of audit events RecoverAI can emit. */
export type AuditEventType =
  | 'TRANSACTION_RECEIVED'
  | 'AI_DIAGNOSIS'
  | 'AI_STRATEGY_RECOMMENDED'
  | 'POLICY_CHECK'
  | 'POLICY_ALLOWED'
  | 'POLICY_BLOCKED'
  | 'HUMAN_REVIEW_REQUIRED'
  | 'HUMAN_APPROVED'
  | 'HUMAN_REJECTED'
  | 'EXECUTION_STARTED'
  | 'EXECUTION_SUCCEEDED'
  | 'EXECUTION_FAILED'
  | 'WEBHOOK_RECEIVED'
  | 'RECOVERY_CONFIRMED'
  | 'RECOVERY_FAILED'
  | 'BATCH_STARTED'
  | 'BATCH_COMPLETED';

export const AUDIT_EVENT_TYPES: readonly AuditEventType[] = [
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

export function isValidAuditEventType(value: string): value is AuditEventType {
  return (AUDIT_EVENT_TYPES as readonly string[]).includes(value);
}

/**
 * Every audit event must be able to answer eight questions. This shape is
 * the enforcement mechanism: you cannot construct an audit entry without
 * supplying WHO, WHAT, WHY and WHAT RESULT. WHEN is derived automatically.
 * WHICH RULE, WHICH ACTION and HOW MUCH are optional because not every
 * event involves a policy rule, a strategy, or money (e.g. BATCH_STARTED).
 */
export interface AuditEventInput {
  /** WHICH ACTION (system-level) — one of the fixed AuditEventType values. */
  event_type: AuditEventType;
  /** WHO — the role that performed or triggered this event. */
  actor_type: ActorType;
  /** WHO — a specific identifier for that actor (e.g. 'demo-ai-provider', 'policy-engine', 'operator-42'). */
  actor_id: string;
  /** WHAT — plain-language description of what happened. */
  what: string;
  /** WHY — the rationale or triggering condition for this event. */
  why: string;
  /** WHAT RESULT — the outcome of this event (e.g. 'ALLOWED', 'BLOCKED', 'SUCCEEDED', 'FAILED'). */
  result: string;
  /** The transaction this event concerns, if any (BATCH_* events may have none). */
  transaction_id?: string;
  /** WHICH RULE — the policy rule id involved, if any. */
  rule_id?: string;
  /** WHICH ACTION (business-level) — the recovery strategy/action this event concerns. */
  action_taken?: string;
  /** HOW MUCH — the amount of money (INR) this event concerns, if any. */
  amount_in_inr?: number;
  state_before?: Record<string, unknown>;
  /** Additional free-form context to merge into state_after (must not collide with the reserved keys below). */
  state_after?: Record<string, unknown>;
}

export interface BuildAuditLogEntryOptions {
  /** Override the generated id — primarily for deterministic testing. */
  id?: string;
  /** Override the "now" timestamp (ISO 8601) — primarily for deterministic testing. */
  nowIso?: string;
}

/**
 * Computes a tamper-evident SHA-256 checksum over the audit entry's
 * meaningful fields (excluding the checksum itself). Field order is fixed
 * explicitly rather than relying on JSON.stringify key ordering, so the
 * hash is reproducible across runs and platforms for identical input.
 */
function computeChecksum(record: Omit<AuditLog, 'checksum_hash'>): string {
  const hashInput = [
    record.id,
    record.transaction_id ?? '',
    record.actor_type,
    record.actor_id,
    record.action_type,
    JSON.stringify(record.state_before ?? null),
    JSON.stringify(record.state_after ?? null),
    record.created_at,
  ].join('|');

  return createHash('sha256').update(hashInput).digest('hex');
}

/**
 * Pure builder: turns an AuditEventInput into a fully-formed, hash-stamped
 * AuditLog record. Does not touch the database — see `recordAuditEvent`
 * for the persisting version. Kept pure so it can be unit tested without
 * a store dependency.
 */
export function buildAuditLogEntry(input: AuditEventInput, options: BuildAuditLogEntryOptions = {}): AuditLog {
  const created_at = options.nowIso ?? new Date().toISOString();
  const id = options.id ?? `audit-${randomUUID()}`;

  const state_after: Record<string, unknown> = {
    who: { actor_type: input.actor_type, actor_id: input.actor_id },
    what: input.what,
    when: created_at,
    why: input.why,
    which_rule: input.rule_id ?? null,
    which_action: input.action_taken ?? null,
    what_result: input.result,
    how_much_inr: input.amount_in_inr ?? null,
    ...input.state_after,
  };

  const base: Omit<AuditLog, 'checksum_hash'> = {
    id,
    transaction_id: input.transaction_id,
    actor_type: input.actor_type,
    actor_id: input.actor_id,
    action_type: input.event_type,
    state_before: input.state_before,
    state_after,
    created_at,
  };

  return {
    ...base,
    checksum_hash: computeChecksum(base),
  };
}

/**
 * Builds an audit entry and persists it to the store. This is the function
 * the rest of the application should call; `buildAuditLogEntry` exists
 * separately so tests can assert on the record shape without a database.
 */
export function recordAuditEvent(input: AuditEventInput, options?: BuildAuditLogEntryOptions): AuditLog {
  const entry = buildAuditLogEntry(input, options);
  return inMemoryStore.insertAuditLog(entry);
}
