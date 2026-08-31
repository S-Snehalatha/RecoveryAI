# RecoverAI — AI Revenue Recovery System

RecoverAI is an autonomous, policy-governed revenue recovery engine for digital transactions, built for the **Razorpay AI Buildathon 2026 (Track 03: AI Revenue Recovery)**.

## Core Safety Principles
1. **AI Recommends, Policy Governs:** LLMs diagnose and suggest recovery strategies; deterministic policy rules decide `ALLOW`, `HUMAN_REVIEW`, or `BLOCK`.
2. **Verified Outcomes Only:** Revenue is only considered recovered when verified through cryptographically verified gateway webhooks (`payment.captured`, `payment_link.paid`) or direct reconciliation.
3. **Demo Simulation Mode:** Works fully out-of-the-box with **zero API keys** (no Anthropic, Razorpay, or Supabase credentials required initially).

## Quickstart
```bash
npm install
npm run type-check
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application shell.
