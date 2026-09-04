# RecoverAI — AI Revenue Recovery System

RecoverAI is an AI-assisted, policy-governed revenue recovery system built for the **Razorpay AI Buildathon 2026 — Track 03: AI Revenue Recovery**.

The system takes transactions whose revenue is at risk, diagnoses the likely reason, recommends a recovery action, checks that recommendation against deterministic safety policies, executes only an allowed action, and records the outcome in an auditable transaction ledger.

> **Current project state:** the core recovery pipeline, deterministic policy layer, metrics/audit model, demo execution path, Razorpay Test Mode adapter, webhook verification, and frontend/transaction ledger are implemented. The repository is currently at the **Phase 8 frontend/transaction-ledger stage**, with CI type-check, tests, and lint passing after the latest frontend fixes.

---

## 1. Problem RecoverAI Solves

Digital businesses lose revenue when a customer is unable or unwilling to complete a payment. Typical examples include:

- Failed card or payment-method transactions
- Abandoned checkouts
- Failed subscription or mandate-related payments
- Overdue B2B receivables

A recovery system cannot simply retry everything. A safe system must answer four questions:

1. **Why is the revenue at risk?**
2. **What recovery action is appropriate?**
3. **Is that action permitted by deterministic business policy?**
4. **Did the action actually recover money, or was it only an attempt?**

RecoverAI separates these responsibilities so that the AI can reason about the transaction without becoming the final authority over financial actions.

---

## 2. Core Design Principle

### AI recommends. Policy governs. Evidence confirms.

The central control flow is:

```text
At-risk transaction
        ↓
Transaction validation
        ↓
AI diagnosis / recommendation
        ↓
Deterministic policy evaluation
        ↓
ALLOW / HUMAN_REVIEW / BLOCK
        ↓
Recovery execution adapter
        ↓
Recovery attempt recorded
        ↓
Gateway result / webhook / reconciliation
        ↓
Verified recovery result
        ↓
Metrics + audit trail + dashboard
```

The AI recommendation is therefore **not** the same thing as an executed recovery, and an execution attempt is **not** the same thing as recovered revenue.

---

## 3. Safety Principles

### 3.1 AI does not override policy

The AI can recommend one of the supported recovery strategies:

- `retry_payment`
- `send_payment_link`
- `retry_mandate`
- `escalate_receivables`
- `human_review`

The deterministic policy engine evaluates that recommendation and produces a governed result such as:

- `ALLOW`
- `HUMAN_REVIEW`
- `BLOCK`

### 3.2 Attempts are not revenue

Creating a recovery action does not automatically mean money was recovered.

For example, creating a Razorpay Payment Link is only an **attempt**. RecoverAI waits for a valid payment confirmation before recording verified recovered revenue.

### 3.3 Verified outcomes only

A recovery result is considered verified only when the system receives an appropriate trusted outcome, such as a cryptographically verified Razorpay webhook or another supported reconciliation signal.

### 3.4 No invented payment APIs

RecoverAI does not fabricate a generic Razorpay endpoint for operations that Razorpay does not document. Unsupported actions remain unsupported instead of being falsely reported as successful.

---

# 4. Project Development Phases

The project was developed as a sequence of controlled phases. Each phase adds one responsibility while preserving the previous safety guarantees.

## Phase 0 — Research and Architecture

### Objective

Define the revenue-recovery problem, supported transaction types, AI responsibilities, policy responsibilities, recovery strategies, and verification rules before writing the execution layer.

### Defined inputs

Each at-risk transaction can contain information such as:

- Transaction amount
- Currency / INR amount representation
- Payment method
- Failure reason
- Customer history
- Time elapsed since the payment became at risk
- Loss type
- Transaction status

### Defined recovery strategies

```text
retry_payment
send_payment_link
retry_mandate
escalate_receivables
human_review
```

### Important architectural decision

The AI is deliberately placed **before** the deterministic policy engine, not after it.

This means the AI can reason flexibly, while the policy engine remains the final safety boundary.

---

## Phase 1 — Application Foundation

### Objective

Create the Next.js + TypeScript application foundation and establish a repeatable development/test workflow.

### Main technology choices

- Next.js 14
- React 18
- TypeScript 5
- Tailwind CSS
- Zod for validation
- Vitest for automated tests
- ESLint for static checks

The project scripts are defined in `package.json`: development uses `npm run dev`, type checking uses `npm run type-check`, tests use `npm test`, and linting uses `npm run lint`. fileciteturn32file0

### Basic setup

```bash
npm install
npm run type-check
npm test
npm run lint
npm run dev
```

The local application is then available at:

```text
http://localhost:3000
```

---

## Phase 2 — Transaction and Data Foundation

### Objective

Represent the revenue-at-risk dataset and maintain the state required by the recovery pipeline.

### Main data concepts

RecoverAI keeps separate records for:

1. Transactions
2. AI decisions
3. Policy decisions
4. Recovery attempts
5. Recovery results
6. Audit events
7. Human reviews

### Demo data

The repository includes a deterministic demo state in:

```text
data/demo_state.json
```

The in-memory store is implemented in:

```text
src/lib/db/inMemoryStore.ts
```

### Demo reset and seed

The project includes:

```bash
npm run seed
npm run reset-demo
```

These scripts are intended to make local/demo testing reproducible without requiring external database credentials.

---

## Phase 3 — AI Diagnosis and Decision Engine

### Objective

Use an AI layer to diagnose why revenue is at risk and recommend an appropriate recovery strategy.

### AI responsibilities

The AI reasons over transaction attributes such as:

- Amount
- Payment method
- Failure reason
- Customer history
- Time elapsed
- Transaction/loss type

The AI produces a structured decision rather than arbitrary free-form text.

### Main AI files

```text
src/lib/ai/anthropic.ts
src/lib/ai/decision.ts
src/lib/ai/demo.ts
src/lib/ai/prompts.ts
src/lib/ai/provider.ts
src/lib/ai/schemas.ts
```

### API route

The AI diagnosis endpoint is:

```text
POST /api/ai/diagnose
```

### Demo mode

RecoverAI has a deterministic demo AI implementation so the project can be run without an Anthropic API key. This is important for development, testing, and demonstration because the core recovery flow does not depend on an external LLM being available.

### Validation

The AI response is validated against defined schemas before the result is accepted by the application.

---

## Phase 4 — Deterministic Policy Engine

### Objective

Make sure AI recommendations cannot directly perform unsafe or non-compliant recovery actions.

### Main file

```text
src/lib/policy.ts
```

### Policy flow

```text
AI recommendation
       ↓
Policy engine
       ↓
ALLOW / HUMAN_REVIEW / BLOCK
```

The policy layer can consider factors such as transaction state, strategy, attempt history, limits, safety rules, and other deterministic constraints defined by the application.

### Why this layer is separate

An LLM is probabilistic. Financial controls must be deterministic and testable.

Therefore:

```text
LLM = reasoning/recommendation
Policy = authorization/control
```

The AI is never allowed to bypass the policy decision.

### Tests

Policy behavior is covered by:

```text
tests/policy.test.ts
```

The policy tests verify that allowed, blocked, and human-review cases behave according to the deterministic rules.

---

## Phase 5 — Audit Trail and Recovery Metrics

### Objective

Measure what happened during recovery and keep an auditable history of decisions and outcomes.

### Audit system

Main file:

```text
src/lib/audit.ts
```

The audit trail records the important stages of a recovery decision so an operator can understand what happened rather than seeing only the final status.

### Metrics

Metrics are implemented under:

```text
src/lib/metrics/
```

The current metric modules cover concepts including:

- Revenue at risk
- Recovery attempted
- Recovery rate
- Incremental recovery
- Verified recovery
- Control-group measurement

### Important distinction

RecoverAI keeps these concepts separate:

```text
Revenue at risk
      ≠
Recovery attempted
      ≠
Recovery verified
```

This prevents an attempted recovery action from being incorrectly counted as recovered money.

### Tests

Metric and audit behavior is covered by:

```text
tests/metrics.test.ts
tests/audit.test.ts
```

---

## Phase 6 — End-to-End Demo Recovery Pipeline

### Objective

Connect transaction ingestion, AI reasoning, policy enforcement, recovery execution, persistence, metrics, and audit logging into one flow.

### Main pipeline

```text
Transaction
   ↓
AI decision
   ↓
Policy decision
   ↓
Recovery attempt
   ↓
Execution adapter
   ↓
Recovery result
   ↓
Metrics + audit
```

### Main implementation

```text
src/lib/recovery/batchRunner.ts
src/lib/recovery/demoExecutionAdapter.ts
```

### Batch API

The batch execution route is:

```text
POST /api/batch/run
```

### Why batch execution matters

The buildathon requirement is not just to demonstrate one successful payment. RecoverAI is designed to process a batch of at-risk transactions and show aggregate outcomes.

For each transaction, the pipeline can retain:

- AI diagnosis
- Recommended strategy
- Confidence/reason
- Policy result
- Recovery attempt
- Recovery result
- Audit events

### End-to-end test

The integrated pipeline is tested by:

```text
tests/recovery-pipeline.test.ts
```

---

# 5. Phase 7 — Razorpay Test Mode Integration

Phase 7 connects the execution layer to **Razorpay Test Mode using documented APIs**.

Detailed integration documentation is maintained separately in:

```text
docs/razorpay-integration.md
```

The implementation uses an adapter architecture so the demo mode and Razorpay mode share the same recovery pipeline.

### Razorpay files

```text
src/lib/razorpay/adapter.ts
src/lib/razorpay/client.ts
src/lib/razorpay/demoExecutionAdapter.ts
src/lib/razorpay/executionAdapter.ts
src/lib/razorpay/razorpayExecutionAdapter.ts
src/lib/razorpay/webhook.ts
```

### Execution modes

The project supports:

```text
Demo execution
Razorpay Test Mode execution
```

The Razorpay mode is selected through environment configuration and requires server-side Razorpay credentials.

### Environment variables

Copy the example configuration:

```bash
cp .env.example .env.local
```

Configure values such as:

```env
EXECUTION_MODE=RAZORPAY_TEST_MODE
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

**Never commit real secrets and never expose Razorpay secret values to client-side code.**

---

## 5.1 Supported Razorpay Recovery Flow — Payment Link

The supported automated Razorpay recovery strategy is:

```text
send_payment_link
```

The adapter uses the documented Razorpay Payment Links API:

```text
POST /v1/payment_links
```

RecoverAI sends the required payment-link information and includes correlation information in the Payment Link notes so the later webhook can be mapped back to the RecoverAI transaction.

### Critical rule

Creating the Payment Link does **not** mean the transaction was recovered.

The state is initially:

```text
Recovery attempt created
```

Only after a valid payment confirmation does RecoverAI create a verified recovery result.

---

## 5.2 Razorpay Webhook Verification

The webhook endpoint is:

```text
POST /api/webhooks/razorpay
```

The route reads the raw request body and verifies the Razorpay webhook signature using HMAC-SHA256 and the configured webhook secret.

Razorpay's event identifier is also used for idempotency.

### Processing sequence

```text
Razorpay webhook
       ↓
Read raw body
       ↓
Verify signature
       ↓
Read event ID
       ↓
Reject duplicate event
       ↓
Identify RecoverAI transaction
       ↓
Confirm supported event
       ↓
Create verified recovery result
       ↓
Update recovery state
```

For Payment Link recovery, the relevant successful event is:

```text
payment_link.paid
```

### Idempotency

If Razorpay delivers the same event again, RecoverAI does not count the recovery twice.

This is required because webhook delivery can be repeated and recovery revenue must remain accurate.

---

## 5.3 Unsupported Razorpay Operations

RecoverAI intentionally does **not** invent APIs for unsupported operations.

### `retry_payment`

The project does not create a new Razorpay Order and call that a payment retry. Order creation is not itself proof of recovered revenue.

### `retry_mandate`

The project does not invent a generic mandate-retry endpoint. Existing Subscription information may be inspected where appropriate, but the adapter does not falsely claim that an arbitrary failed mandate has been retried.

### `escalate_receivables`

The gateway adapter does not pretend that a generic Razorpay API call is a receivables-escalation system.

These cases remain governed by the policy/human-review path rather than producing false recovery results.

---

# 6. Phase 8 — Frontend and Transaction Ledger

### Objective

Turn the underlying recovery records into an operator-facing interface that makes the recovery process understandable and auditable.

### Current frontend responsibilities

The frontend is designed to show:

- Revenue at risk
- Recovery attempts
- Verified recovered revenue
- Recovery rate
- Policy decisions
- AI recommendations
- Transaction-level recovery state
- Human-review information
- Audit information

### Main frontend files

```text
app/page.tsx
app/transactions/page.tsx
components/dashboard/DashboardClient.tsx
components/transactions/TransactionTableClient.tsx
components/transactions/ProfessionalTransactionTable.tsx
```

Additional application pages/components are present under:

```text
src/app/
src/components/
```

including dashboard, transactions, simulation, reviews, and audit-related screens.

### Dashboard concept

The dashboard is intended to answer the operator's most important questions immediately:

```text
How much revenue is at risk?
How much recovery has been attempted?
How much money is actually verified as recovered?
How many actions were allowed?
How many were blocked?
How many require human review?
What strategies are being recommended?
```

### Transaction ledger concept

The transaction table gives a transaction-level view rather than only aggregate numbers.

A transaction can be followed through its lifecycle:

```text
At risk
  ↓
AI recommendation
  ↓
Policy decision
  ↓
Recovery attempt
  ↓
Execution state
  ↓
Verification
  ↓
Recovered / not recovered
```

This is why the frontend is more than a simple list of payments: it acts as an operator control surface over the recovery ledger.

---

# 7. Frontend/API Relationship

The frontend reads the same transaction and recovery state that the backend pipeline updates.

The high-level relationship is:

```text
                     ┌──────────────────┐
                     │   Transaction    │
                     │      Data        │
                     └────────┬─────────┘
                              ↓
                     ┌──────────────────┐
                     │  Recovery Engine │
                     └────────┬─────────┘
                              ↓
            ┌─────────────────┼─────────────────┐
            ↓                 ↓                 ↓
       AI Decision        Policy           Execution
            ↓                 ↓                 ↓
            └─────────────────┼─────────────────┘
                              ↓
                     Recovery / Audit Data
                              ↓
                     ┌──────────────────┐
                     │    Frontend      │
                     │ Dashboard/Ledger │
                     └──────────────────┘
```

The frontend should never be treated as the authority for whether money was recovered. The underlying recovery state and verification logic remain authoritative.

---

# 8. API Routes

The repository contains API routes for the core application flow.

### AI diagnosis

```text
POST /api/ai/diagnose
```

Used to obtain a structured AI diagnosis/recommendation for a transaction.

### Batch recovery

```text
POST /api/batch/run
```

Runs the recovery pipeline over the selected batch.

### Transaction details

```text
GET /api/transactions/:id
```

Used for transaction-level information.

### Razorpay webhook

```text
POST /api/webhooks/razorpay
```

Receives and verifies Razorpay webhook events.

---

# 9. Repository Structure

The important project areas are:

```text
RecoveryAI/
│
├── app/
│   ├── page.tsx                         # Main dashboard route
│   ├── transactions/page.tsx            # Transactions route
│   └── api/                              # Application API routes
│
├── components/
│   ├── dashboard/
│   │   └── DashboardClient.tsx           # Dashboard client UI
│   └── transactions/
│       ├── ProfessionalTransactionTable.tsx
│       └── TransactionTableClient.tsx
│
├── src/
│   ├── app/                              # Additional application/API pages
│   ├── components/                       # Shared application components
│   ├── lib/
│   │   ├── ai/                           # AI reasoning and schemas
│   │   ├── config/                       # Environment/demo configuration
│   │   ├── db/                           # Data store abstraction
│   │   ├── logger/                       # Logging
│   │   ├── metrics/                      # Recovery metrics
│   │   ├── razorpay/                     # Razorpay adapters/webhooks
│   │   ├── recovery/                     # End-to-end recovery pipeline
│   │   ├── synthetic/                    # Synthetic transaction generation
│   │   └── validation/                   # Input validation
│   └── types/                             # Shared TypeScript types
│
├── data/
│   └── demo_state.json                   # Demo transaction/state data
│
├── docs/
│   └── razorpay-integration.md            # Phase 7 integration details
│
├── scripts/
│   ├── seed.ts                            # Seed demo data
│   └── reset-demo.ts                      # Reset demo state
│
├── tests/
│   ├── ai-decision.test.ts
│   ├── audit.test.ts
│   ├── metrics.test.ts
│   ├── policy.test.ts
│   ├── razorpay-integration.test.ts
│   ├── recovery-pipeline.test.ts
│   └── helpers/factories.ts
│
├── .env.example                           # Environment variable template
├── .github/workflows/main.yml             # CI workflow
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

# 10. How to Run RecoverAI Locally

## Step 1 — Clone the repository

```bash
git clone https://github.com/S-Snehalatha/RecoveryAI.git
cd RecoveryAI
```

## Step 2 — Install dependencies

```bash
npm install
```

## Step 3 — Configure environment variables

For demo mode, the project is designed to work without external API credentials.

If using environment configuration locally:

```bash
cp .env.example .env.local
```

For Razorpay Test Mode, fill only the server-side Test Mode values required by the application.

## Step 4 — Run type checking

```bash
npm run type-check
```

This checks the complete TypeScript project without emitting compiled files.

## Step 5 — Run automated tests

```bash
npm test
```

## Step 6 — Run lint

```bash
npm run lint
```

## Step 7 — Start the development server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

# 11. Recommended Local Verification Sequence

When checking whether the project is healthy, run the checks in this order:

```bash
npm install
npm run type-check
npm test
npm run lint
npm run build
```

Then start the application:

```bash
npm run dev
```

This separates code correctness from browser/frontend verification.

---

# 12. Automated Testing

RecoverAI uses Vitest.

Run all tests with:

```bash
npm test
```

The test suite currently covers the major safety-critical areas:

### AI decision tests

```text
tests/ai-decision.test.ts
```

Checks structured AI decision behavior and persistence-related decision flow.

### Policy tests

```text
tests/policy.test.ts
```

Checks deterministic policy outcomes.

### Audit tests

```text
tests/audit.test.ts
```

Checks audit records and audit behavior.

### Metrics tests

```text
tests/metrics.test.ts
```

Checks revenue-at-risk, recovery-attempted, verified recovery, recovery-rate, incremental-recovery, and related metric behavior.

### Recovery pipeline tests

```text
tests/recovery-pipeline.test.ts
```

Checks the integrated transaction → AI → policy → recovery pipeline.

### Razorpay integration tests

```text
tests/razorpay-integration.test.ts
```

Checks the documented integration behavior, authentication/error handling, webhook verification/idempotency behavior, and recovery confirmation logic.

---

# 13. GitHub Actions CI

The project uses:

```text
.github/workflows/main.yml
```

The CI workflow validates the project automatically.

The important checks are:

```text
npm install
    ↓
npm test
    ↓
npm run type-check
    ↓
npm run lint
```

A green workflow means the automated test suite, TypeScript compiler check, and lint check have passed for that run.

The latest verified CI state after the frontend/type-check fixes was green, including:

- Test suite
- TypeScript type-check
- ESLint

---

# 14. Demo Mode vs Razorpay Test Mode

## Demo Mode

Use Demo Mode when:

- Developing locally
- Testing the complete pipeline
- Demonstrating the UI
- Running without external credentials
- Running automated tests

Demo Mode is deterministic and does not require a live Razorpay account.

## Razorpay Test Mode

Use Razorpay Test Mode when:

- Testing documented Razorpay API calls
- Creating a Test Mode Payment Link
- Testing the webhook flow
- Verifying signature handling
- Demonstrating a real gateway-side test payment lifecycle

Test Mode is still not production payment processing.

---

# 15. Verified Recovery Lifecycle

The most important state transition in RecoverAI is:

```text
AT_RISK
   ↓
AI_RECOMMENDED
   ↓
POLICY_EVALUATED
   ↓
RECOVERY_ATTEMPTED
   ↓
WAITING_FOR_VERIFICATION
   ↓
VERIFIED_RECOVERED
```

A failed or unsupported path can instead end in a non-recovered state or a human-review path.

The critical rule is:

```text
Recovery attempt ≠ recovered revenue
```

For a Razorpay Payment Link, the system waits for the appropriate verified event before adding the amount to recovered revenue.

---

# 16. Idempotency and Duplicate Protection

Financial recovery systems must not double-count the same payment.

RecoverAI therefore uses event-level and recovery-level duplicate protection.

For Razorpay webhook processing:

```text
Incoming event
      ↓
Event ID lookup
      ↓
Already processed?
   ↙          ↘
 yes           no
 ↓              ↓
ignore       process once
```

The system also checks that the recovery attempt/result has not already been finalized.

This protects the dashboard and metrics from counting one payment more than once.

---

# 17. Error Handling Philosophy

Errors are treated as errors, not as successful recovery.

Examples:

- Invalid Razorpay credentials → API error
- Invalid webhook signature → rejected webhook
- Duplicate webhook → ignored as duplicate
- Unsupported recovery strategy → refused rather than fabricated
- Payment Link creation → recovery attempt only
- No successful payment confirmation → no verified recovery

This is especially important because a financial system should prefer an explicit non-success state over a misleading success state.

---

# 18. Security Rules

### Secrets

Never commit:

```text
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
Anthropic API secrets
```

Only public/non-secret configuration belongs in source-controlled example files.

### Server-side credentials

Razorpay secret credentials must remain server-side.

### Webhooks

Never trust a Razorpay webhook merely because it reaches the endpoint. Signature verification must happen before processing the event.

### Idempotency

Never assume a webhook is delivered exactly once.

### Recovery accounting

Never count an attempted action as recovered revenue without verification.

---

# 19. What the Dashboard Represents

The dashboard is an operational view over the recovery ledger.

A typical operator should be able to distinguish:

### Revenue at risk

The amount represented by transactions that are currently at risk.

### Recovery attempted

Transactions for which RecoverAI actually initiated a permitted recovery action.

### Verified recovered revenue

Money for which the system has a trusted recovery confirmation.

### Recovery rate

A rate derived from the recorded recovery data rather than simply counting AI recommendations.

### Policy outcomes

The dashboard can distinguish actions that were:

- Allowed
- Blocked
- Sent to human review

### Strategy distribution

The transaction/recovery views can show which recovery strategies the decision engine is recommending and/or executing.

---

# 20. Human Review Boundary

The `human_review` strategy exists for cases where automated action should not proceed.

The intended control flow is:

```text
AI recommendation
       ↓
Policy evaluation
       ↓
HUMAN_REVIEW
       ↓
Operator decision
       ↓
Approved action OR no action
```

This prevents the AI from automatically performing a high-risk or unsupported operation simply because it recommended it.

---

# 21. Synthetic/Demo Transactions

The project includes synthetic transaction generation under:

```text
src/lib/synthetic/generator.ts
```

Synthetic data is useful for demonstrating different failure patterns without exposing real customer information.

The demo dataset can represent different loss types such as:

```text
failed_payment
abandoned_checkout
subscription_failure
overdue_receivable
```

This allows the recovery pipeline and dashboard to be exercised across multiple transaction conditions.

---

# 22. Current Implementation Status

| Area | Status |
|---|---|
| Project foundation | Implemented |
| Transaction/data model | Implemented |
| AI diagnosis/decision layer | Implemented |
| Deterministic policy engine | Implemented |
| Audit trail | Implemented |
| Recovery metrics | Implemented |
| Batch recovery pipeline | Implemented |
| Demo execution | Implemented |
| Razorpay Test Mode adapter | Implemented |
| Payment Link recovery flow | Implemented |
| Razorpay webhook verification | Implemented |
| Webhook idempotency | Implemented |
| Transaction ledger frontend | Implemented |
| Dashboard frontend | Implemented |
| Automated tests | Implemented |
| TypeScript CI check | Passing |
| Lint CI check | Passing |

---

# 23. Current Project Phase

The project has completed the core backend/recovery foundation through **Phase 7** and is currently in **Phase 8: Frontend and Transaction Ledger**.

The immediate focus of Phase 8 is the operator-facing frontend: presenting the recovery ledger, governed decisions, verified outcomes, and transaction details clearly and professionally.

The repository should not be considered complete merely because the frontend renders. The recovery system's correctness continues to depend on the backend policy, execution, verification, audit, and metric layers.

---

# 24. Important Files by Responsibility

| Responsibility | File/Directory |
|---|---|
| AI provider | `src/lib/ai/provider.ts` |
| AI prompts | `src/lib/ai/prompts.ts` |
| AI schemas | `src/lib/ai/schemas.ts` |
| AI decision | `src/lib/ai/decision.ts` |
| Policy engine | `src/lib/policy.ts` |
| Audit | `src/lib/audit.ts` |
| Metrics | `src/lib/metrics/` |
| Recovery batch runner | `src/lib/recovery/batchRunner.ts` |
| Demo execution | `src/lib/recovery/demoExecutionAdapter.ts` |
| Razorpay client | `src/lib/razorpay/client.ts` |
| Razorpay execution | `src/lib/razorpay/razorpayExecutionAdapter.ts` |
| Razorpay webhook logic | `src/lib/razorpay/webhook.ts` |
| Data store | `src/lib/db/inMemoryStore.ts` |
| Shared types | `src/types/index.ts` |
| Validation | `src/lib/validation/schemas.ts` |
| Main dashboard | `app/page.tsx` |
| Dashboard client | `components/dashboard/DashboardClient.tsx` |
| Transaction page | `app/transactions/page.tsx` |
| Transaction table | `components/transactions/ProfessionalTransactionTable.tsx` |
| Transaction client | `components/transactions/TransactionTableClient.tsx` |
| Razorpay documentation | `docs/razorpay-integration.md` |
| Test suite | `tests/` |
| CI | `.github/workflows/main.yml` |

---

# 25. Full RecoveryAI Architecture

```text
                         RECOVERAI
                            │
                            ▼
                  ┌───────────────────┐
                  │ At-Risk Transactions│
                  └─────────┬─────────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │ Input Validation  │
                  └─────────┬─────────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │ AI Diagnosis      │
                  │ + Recommendation  │
                  └─────────┬─────────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │ Deterministic     │
                  │ Policy Engine     │
                  └──────┬────┬───────┘
                         │    │
               ALLOW ────┘    └──── BLOCK / HUMAN_REVIEW
                         │
                         ▼
                  ┌───────────────────┐
                  │ Execution Adapter │
                  └─────────┬─────────┘
                            │
                 ┌──────────┴──────────┐
                 ▼                     ▼
          Demo Execution        Razorpay Test Mode
                                       │
                                       ▼
                                  Gateway Event
                                       │
                                       ▼
                                Webhook Verification
                                       │
                                       ▼
                              Verified Recovery Result
                                       │
                       ┌───────────────┼───────────────┐
                       ▼               ▼               ▼
                    Metrics          Audit         Dashboard
```

---

# 26. Buildathon Requirement Mapping

| Buildathon requirement | RecoverAI implementation |
|---|---|
| Ingest at-risk transactions | Transaction model + demo/synthetic data |
| Diagnose revenue risk | AI diagnosis/decision layer |
| Use transaction/customer context | AI prompt/schema input model |
| Select recovery strategy | Structured AI decision |
| Confidence/reason | Structured decision output |
| Deterministic governance | Policy engine |
| Recovery execution | Execution adapter architecture |
| Razorpay integration | Razorpay Test Mode adapter |
| Compliant escalation | Policy + human-review path |
| Stopping/duplicate controls | Policy limits + idempotency checks |
| Audit trail | Audit module |
| Measure recovered money | Verified recovery metrics |
| Batch demonstration | Recovery batch runner |
| Operator visibility | Dashboard + transaction ledger |

---

# 27. What Must Never Be Claimed

To keep the system financially and technically honest, RecoverAI must never claim:

1. **AI recommendation = recovery.**
2. **Payment Link creation = recovered revenue.**
3. **Order creation = successful payment.**
4. **An unsupported Razorpay operation = successful retry.**
5. **A webhook without a valid signature = trusted payment confirmation.**
6. **A repeated webhook = a second recovery.**
7. **An API request that returned an error = recovered money.**

The system is intentionally conservative in all of these situations.

---

# 28. Phase-by-Phase Summary

```text
Phase 0  → Research + architecture
Phase 1  → Application foundation
Phase 2  → Transaction/data foundation
Phase 3  → AI diagnosis + decision engine
Phase 4  → Deterministic policy governance
Phase 5  → Audit + recovery metrics
Phase 6  → End-to-end demo recovery pipeline
Phase 7  → Razorpay Test Mode integration
Phase 8  → Frontend + professional transaction ledger  ← CURRENT
```

Each phase builds on the previous one. The defining architectural rule throughout the project is:

> **AI can recommend an action, deterministic policy can authorize or reject it, and only verified payment evidence can establish recovered revenue.**

---

# 29. Quick Command Reference

```bash
# Install
npm install

# Development
npm run dev

# TypeScript
npm run type-check

# Tests
npm test

# Lint
npm run lint

# Production build
npm run build

# Start production server
npm start

# Seed demo data
npm run seed

# Reset demo data
npm run reset-demo
```

---

# 30. Razorpay Integration Documentation

For the detailed Phase 7 Test Mode setup, supported operations, webhook verification, idempotency, and verification matrix, see:

```text
docs/razorpay-integration.md
```

The README provides the overall project explanation; the Razorpay document contains the gateway-specific implementation details.

---

## License / Buildathon Project

RecoverAI is a buildathon project created for the **Razorpay AI Buildathon 2026 — Track 03: AI Revenue Recovery**.
