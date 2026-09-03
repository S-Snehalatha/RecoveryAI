# RecoverAI — Razorpay Test Mode Integration (Phase 7)

This integration uses Razorpay's documented Test Mode APIs only. Credentials stay server-side in environment variables.

## Configuration

```env
EXECUTION_MODE=RAZORPAY_TEST_MODE
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

Never expose these values to client-side code.

## Adapter architecture

The recovery pipeline calls the execution-adapter interface. `DemoExecutionAdapter` remains the deterministic Phase 6 implementation; `RazorpayExecutionAdapter` is selected only when `EXECUTION_MODE=RAZORPAY_TEST_MODE` and both API credentials exist. Policy evaluation is unchanged.

## Supported workflow: Payment Link recovery

**Strategy:** `send_payment_link`

**API:** `POST /v1/payment_links`

**Request:** amount in paise, `currency: INR`, a unique `reference_id`, customer details, and RecoverAI correlation data in `notes`.

**Response:** Razorpay returns the Payment Link id, status and `short_url`.

**Verification:** creation of the link is only a recovery attempt. RecoverAI does not insert a recovered result at creation time. A signed Razorpay `payment_link.paid` webhook is required; the webhook payload must identify the RecoverAI transaction through the stored correlation notes.

**Recovery event:** after signature verification and idempotency checks, RecoverAI creates one `VERIFIED_RECOVERED` result with `verification_source=WEBHOOK_SIGNATURE` and the captured amount, then marks the transaction recovered.

Razorpay documents Payment Links as payment-collection URLs and documents `payment_link.paid` webhook events. Test Mode supports creating and testing Payment Links. See the official docs: https://razorpay.com/docs/api/payments/payment-links/create-standard/ and https://razorpay.com/docs/webhooks/payment-links/.

## Orders / payments

**Strategy:** no generic `retry_payment` API call is fabricated.

Razorpay Orders are an order-management resource associated with payments. Creating an Order is **not** treated as recovered revenue. A payment outcome must actually be captured before RecoverAI can record recovered revenue.

The current Phase 7 adapter therefore refuses `retry_payment` rather than creating a new Order and falsely calling it a retry. If a supported Checkout/Order flow is added later, the recovery event must be based on a real captured payment (`payment.captured` / `order.paid`) and not Order creation itself.

Official references: https://razorpay.com/docs/api/orders/ and https://razorpay.com/docs/webhooks/payments/.

## Subscriptions / mandates

**Strategy:** no invented `retry_mandate` endpoint.

Razorpay documents Subscription resources, including fetching a Subscription by id, creating Subscription/Subscription Link resources, pausing/resuming, and related lifecycle operations. It does not provide a generic endpoint that RecoverAI can truthfully label as “retry this failed mandate” for an arbitrary existing transaction.

The adapter therefore inspects an existing Subscription id when one is supplied, but does not invent or execute a mandate-retry operation. The transaction remains subject to the policy/human-review path instead of being falsely marked recovered.

Official reference: https://razorpay.com/docs/api/payments/subscriptions/.

## Receivables escalation

**Strategy:** `escalate_receivables`

No generic Razorpay API action in this integration is treated as a receivables-escalation operation. RecoverAI refuses to fake an API call and leaves this strategy outside the automated Razorpay execution path.

## Webhook security and idempotency

Endpoint: `/api/webhooks/razorpay`

The route reads the **raw request body** before JSON parsing. It verifies `X-Razorpay-Signature` using HMAC-SHA256 with `RAZORPAY_WEBHOOK_SECRET`. Razorpay also supplies `x-razorpay-event-id`, which is unique per event and is stored before processing. A repeated event id is returned as a duplicate and is not processed again.

For `payment_link.paid`, RecoverAI additionally checks that the event maps to a known Razorpay Test Mode recovery attempt and that no recovery result already exists for that attempt. This prevents the same recovery from being counted twice.

Official reference: https://razorpay.com/docs/webhooks/validate-test/ and https://razorpay.com/docs/webhooks/best-practices/.

## Verification matrix

| Strategy | API | What counts as recovery? |
|---|---|---|
| `send_payment_link` | `POST /v1/payment_links` | A signed `payment_link.paid` webhook confirming payment |
| `retry_payment` | None used | No recovery is claimed; unsupported generic retry is refused |
| `retry_mandate` | Existing Subscription can be fetched with `GET /v1/subscriptions/:id` | No mandate retry is claimed; unsupported generic retry is refused |
| `escalate_receivables` | None used | No gateway recovery is claimed |

## Test checklist

1. Set `EXECUTION_MODE=RAZORPAY_TEST_MODE` with Test Mode credentials.
2. Test API authentication with a harmless documented API request and confirm a successful response.
3. Create a Payment Link using `POST /v1/payment_links`; confirm the response contains a link id/URL and keep the transaction unrecovered.
4. Complete a Test Mode Payment Link payment; receive `payment_link.paid` at `/api/webhooks/razorpay`.
5. Test an invalid signature; the endpoint must reject it.
6. Send the same signed event id twice; the second delivery must be treated as a duplicate.
7. Test a Razorpay API failure response; the adapter must surface the error and must not create a false recovery result.
8. Confirm recovery only after the verified payment event.

Razorpay Test Mode has documented limits for Payment Links; use the Dashboard's Test Mode flow for test payments.
