import {
  Transaction,
  LossType,
  PaymentMethod,
  CustomerTier,
  DemoScenario,
  ExperimentGroup,
  TransactionStatus,
} from '@/types';

// Deterministic Pseudo-Random Number Generator (Linear Congruential Generator)
class DeterministicRNG {
  private state: number;

  constructor(seed = 422026) {
    this.state = seed;
  }

  next(): number {
    this.state = (this.state * 1664525 + 1013904223) % 4294967296;
    return this.state / 4294967296;
  }

  range(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(items: readonly T[]): T {
    const idx = Math.floor(this.next() * items.length);
    return items[idx]!;
  }
}

const FIRST_NAMES = [
  'Aarav', 'Sneha', 'Rohan', 'Priya', 'Vikram', 'Ananya', 'Karan', 'Deepika',
  'Aditya', 'Pooja', 'Manish', 'Divya', 'Siddharth', 'Meera', 'Gaurav', 'Neha',
  'Rahul', 'Swati', 'Abhishek', 'Kavita', 'Tarun', 'Shweta', 'Rajesh', 'Sunita',
  'Arjun', 'Simran', 'Varun', 'Ritu', 'Nikhil', 'Tanvi'
] as const;

const LAST_NAMES = [
  'Sharma', 'Patel', 'Verma', 'Sundaram', 'Rao', 'Iyer', 'Malhotra', 'Joshi',
  'Nair', 'Reddy', 'Gupta', 'Deshmukh', 'Mehta', 'Kulkarni', 'Bhat', 'Bose',
  'Sen', 'Chopra', 'Saxena', 'Kapoor', 'Menon', 'Agarwal', 'Chatterjee', 'Das'
] as const;

const B2B_COMPANIES = [
  'TechNova Solutions Pvt Ltd',
  'CloudSpire Digital Services',
  'BharatLogistics Hub LLP',
  'Nexus FinServe Pvt Ltd',
  'InfraCorp India Ltd',
  'Apex Analytics Global',
  'GreenPulse Energy India',
  'Vanguard Healthcare Systems',
  'Zephyr Creative Labs',
  'Horizon Retail Tech'
] as const;

const SUBSCRIPTION_PLANS = [
  'Starter Cloud Monthly',
  'Pro Analytics Annual',
  'Business Scale Monthly',
  'Developer Tier Monthly',
  'Enterprise Workspace Quarterly'
] as const;

export function generateSyntheticDataset(targetCount = 120): Transaction[] {
  const rng = new DeterministicRNG(20260831);
  const transactions: Transaction[] = [];

  const baseDate = new Date('2026-08-30T10:00:00Z');

  // Helper to create a formatted transaction
  const createTx = (
    index: number,
    lossType: LossType,
    amount: number,
    paymentMethod: PaymentMethod,
    scenario: DemoScenario,
    status: TransactionStatus,
    attemptCount: number,
    previousSuccess: number,
    customOverrides: Partial<Transaction> = {}
  ): Transaction => {
    const isB2B = lossType === 'overdue_receivable';
    const firstName = rng.pick(FIRST_NAMES);
    const lastName = rng.pick(LAST_NAMES);
    const company = rng.pick(B2B_COMPANIES);

    const customerName = isB2B ? `${company} (Attn: ${firstName} ${lastName})` : `${firstName} ${lastName}`;
    const emailPrefix = isB2B
      ? `billing@${company.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12)}.in`
      : `${firstName.toLowerCase()}.${lastName.toLowerCase()}${rng.range(10, 99)}@example.com`;
    const phone = `+91 9${rng.range(100000000, 999999999)}`;
    const tier: CustomerTier = amount > 50000 ? 'ENTERPRISE' : amount > 15000 ? 'VIP' : 'STANDARD';

    const createdAt = new Date(baseDate.getTime() - rng.range(1, 14) * 86400000 - rng.range(100, 80000) * 1000).toISOString();

    const group: ExperimentGroup = rng.next() > 0.2 ? 'AI_RECOVERY_GROUP' : 'CONTROL_GROUP';

    const refPrefix = lossType === 'failed_payment' ? 'pay_fail'
      : lossType === 'abandoned_checkout' ? 'ord_abnd'
      : lossType === 'subscription_failure' ? 'sub_fail'
      : 'inv_overdue';

    return {
      id: `tx-0000-0000-${String(index).padStart(4, '0')}-2026`,
      original_reference_id: `${refPrefix}_${rng.range(100000, 999999)}`,
      loss_type: lossType,
      amount_in_inr: amount,
      currency: 'INR',
      customer_id: `cust_${rng.range(10000, 99999)}`,
      customer_name: customerName,
      customer_email: emailPrefix,
      customer_phone: phone,
      customer_tier: tier,
      customer_ltv_inr: rng.range(amount * 2, amount * 12),
      customer_tenure_days: rng.range(30, 720),
      payment_method: paymentMethod,
      attempt_count: attemptCount,
      previous_successful_payments: previousSuccess,
      experiment_group: group,
      demo_scenario: scenario,
      status: status,
      created_at: createdAt,
      updated_at: createdAt,
      ...customOverrides,
    };
  };

  let index = 1;

  // 1. DETERMINISTIC DEMO SCENARIOS (1 to 9)
  // Scenario 1: SAFE_AUTO_RETRY
  transactions.push(
    createTx(
      index++,
      'failed_payment',
      2499.00,
      'card',
      'SAFE_AUTO_RETRY',
      'POLICY_APPROVED',
      1,
      5,
      {
        gateway_error_code: 'BAD_REQUEST_PAYMENT_TIMED_OUT',
        failure_reason_raw: 'Customer network timed out during 3D Secure verification.',
      }
    )
  );

  // Scenario 2: OVER_LIMIT_REVIEW
  transactions.push(
    createTx(
      index++,
      'failed_payment',
      32500.00,
      'card',
      'OVER_LIMIT_REVIEW',
      'NEEDS_HUMAN_REVIEW',
      1,
      4,
      {
        gateway_error_code: 'INSUFFICIENT_FUNDS',
        failure_reason_raw: 'Card limit exceeded on checkout. High-value payment link required.',
      }
    )
  );

  // Scenario 3: LOW_CONFIDENCE_REVIEW
  transactions.push(
    createTx(
      index++,
      'abandoned_checkout',
      7800.00,
      'upi',
      'LOW_CONFIDENCE_REVIEW',
      'NEEDS_HUMAN_REVIEW',
      2,
      0,
      {
        gateway_error_code: 'SUSPECTED_ABANDON_ANOMALY',
        failure_reason_raw: 'Repeated address changes followed by fast cart exit. Low confidence in automated link.',
      }
    )
  );

  // Scenario 4: PAYMENT_LINK_RECOVERY
  transactions.push(
    createTx(
      index++,
      'abandoned_checkout',
      4200.00,
      'upi',
      'PAYMENT_LINK_RECOVERY',
      'POLICY_APPROVED',
      1,
      2,
      {
        gateway_error_code: 'CUSTOMER_DROPPED_OFF',
        failure_reason_raw: 'User exited checkout at UPI intent screen. High conversion probability via payment link.',
      }
    )
  );

  // Scenario 5: SUBSCRIPTION_REVIEW
  transactions.push(
    createTx(
      index++,
      'subscription_failure',
      4999.00,
      'mandate_nach',
      'SUBSCRIPTION_REVIEW',
      'NEEDS_HUMAN_REVIEW',
      2,
      1,
      {
        subscription_id: 'sub_Nx9847192',
        subscription_plan_name: 'Pro Analytics Annual',
        gateway_error_code: 'MANDATE_DECLINED_BY_ISSUER',
        failure_reason_raw: 'NACH recurring debit rejected. History < 3 payments requires manual account manager touch.',
      }
    )
  );

  // Scenario 6: HIGH_VALUE_RECEIVABLE
  transactions.push(
    createTx(
      index++,
      'overdue_receivable',
      185000.00,
      'invoice_bank_transfer',
      'HIGH_VALUE_RECEIVABLE',
      'NEEDS_HUMAN_REVIEW',
      1,
      3,
      {
        invoice_id: 'inv_2026_0984',
        invoice_due_date: '2026-08-15T00:00:00Z',
        invoice_overdue_days: 16,
        failure_reason_raw: 'Enterprise Net-30 invoice overdue by 16 days. Over ₹50,000 policy threshold triggers human review.',
      }
    )
  );

  // Scenario 7: BLOCKED_ACTION
  transactions.push(
    createTx(
      index++,
      'failed_payment',
      12000.00,
      'card',
      'BLOCKED_ACTION',
      'REJECTED_BY_POLICY',
      4,
      0,
      {
        gateway_error_code: 'MAX_RETRIES_EXCEEDED',
        failure_reason_raw: 'Exceeded maximum permitted attempts (4 attempts). Deterministic rule BLOCKS further automated retries.',
      }
    )
  );

  // Scenario 8: SUCCESSFUL_RECOVERY
  transactions.push(
    createTx(
      index++,
      'failed_payment',
      3499.00,
      'upi',
      'SUCCESSFUL_RECOVERY',
      'RECOVERED',
      1,
      6,
      {
        gateway_error_code: 'UPI_COLLECT_EXPIRED',
        failure_reason_raw: 'Initial UPI collect expired. Recovered via smart Payment Link with verified webhook payment.captured.',
      }
    )
  );

  // Scenario 9: FAILED_RECOVERY
  transactions.push(
    createTx(
      index++,
      'subscription_failure',
      1999.00,
      'mandate_upi',
      'FAILED_RECOVERY',
      'RECOVERY_FAILED',
      3,
      1,
      {
        subscription_id: 'sub_Fx1092837',
        subscription_plan_name: 'Developer Tier Monthly',
        gateway_error_code: 'MANDATE_CANCELLED_BY_USER',
        failure_reason_raw: 'Customer actively revoked UPI mandate with issuing bank.',
      }
    )
  );

  // 2. GENERATE REMAINING TRANSACTIONS TO REACH TARGET COUNT (~120 total)
  const lossDistribution: LossType[] = [
    'failed_payment',
    'abandoned_checkout',
    'subscription_failure',
    'overdue_receivable',
  ];

  const failureReasons: Record<LossType, readonly { code: string; reason: string }[]> = {
    failed_payment: [
      { code: 'INSUFFICIENT_FUNDS', reason: 'Insufficient account balance at time of debit.' },
      { code: 'BANK_SERVER_DOWN', reason: 'Issuer switch downtime during OTP verification.' },
      { code: 'CARD_BLOCKED', reason: 'Card temporarily restricted for online commerce by bank.' },
      { code: 'OTP_EXPIRED', reason: 'Customer did not enter 2FA code in 180s.' },
      { code: 'UPI_PIN_ERROR', reason: 'Customer entered incorrect MPIN twice.' },
    ],
    abandoned_checkout: [
      { code: 'DROP_AT_PAYMENT_SELECT', reason: 'Customer selected card but did not submit CVV.' },
      { code: 'COUPON_FAILURE_EXIT', reason: 'Promo code rejected, customer abandoned cart.' },
      { code: 'SHIPPING_FEE_SURPRISE', reason: 'User navigated away after final total display.' },
      { code: 'UPI_APP_SWITCH_FAIL', reason: 'PhonePe app intent failed to open on device.' },
    ],
    subscription_failure: [
      { code: 'MANDATE_INSUFFICIENT_FUNDS', reason: 'Auto-debit failed on cycle renewal date.' },
      { code: 'CARD_EXPIRING_SOON', reason: 'Card token nearing expiry date.' },
      { code: 'MANDATE_LIMIT_EXCEEDED', reason: 'Amount exceeded registered e-mandate limit.' },
      { code: 'ISSUER_RECURRING_DOWN', reason: 'Standing instruction debit queue timed out.' },
    ],
    overdue_receivable: [
      { code: 'INVOICE_PENDING_PO', reason: 'Client AP team awaiting internal PO approval.' },
      { code: 'DISPUTED_LINE_ITEM', reason: 'Minor line item clarification requested by customer.' },
      { code: 'QUARTER_END_DELAY', reason: 'Disbursement scheduled in upcoming pay cycle.' },
      { code: 'BANK_BENEFICIARY_PENDING', reason: 'Vendor registration active but cooling period in effect.' },
    ],
  };

  while (transactions.length < targetCount) {
    const lossType = lossDistribution[transactions.length % 4]!;
    const reasons = failureReasons[lossType];
    const pickedReason = rng.pick(reasons);

    let amount = 0;
    let paymentMethod: PaymentMethod = 'card';
    let subInfo: Partial<Transaction> = {};
    let invInfo: Partial<Transaction> = {};

    if (lossType === 'failed_payment') {
      amount = rng.pick([499, 999, 1499, 2499, 3999, 4999, 7500, 12000, 18500, 24900]);
      paymentMethod = rng.pick(['card', 'upi', 'netbanking']);
    } else if (lossType === 'abandoned_checkout') {
      amount = rng.pick([699, 1299, 2199, 3499, 4800, 6200, 8900, 14500, 21000]);
      paymentMethod = rng.pick(['upi', 'card']);
    } else if (lossType === 'subscription_failure') {
      amount = rng.pick([999, 1999, 2999, 4999, 7999, 9999]);
      paymentMethod = rng.pick(['mandate_nach', 'mandate_upi']);
      subInfo = {
        subscription_id: `sub_${rng.range(1000000, 9999999)}`,
        subscription_plan_name: rng.pick(SUBSCRIPTION_PLANS),
      };
    } else {
      amount = rng.pick([15000, 28000, 45000, 65000, 85000, 125000, 210000, 340000]);
      paymentMethod = 'invoice_bank_transfer';
      invInfo = {
        invoice_id: `inv_2026_${rng.range(1000, 9999)}`,
        invoice_due_date: new Date(baseDate.getTime() - rng.range(5, 45) * 86400000).toISOString(),
        invoice_overdue_days: rng.range(5, 45),
      };
    }

    const previousSuccess = rng.range(0, 10);
    const attemptCount = rng.range(1, 3);
    const statusPool: TransactionStatus[] = [
      'INGESTED',
      'DIAGNOSED',
      'POLICY_APPROVED',
      'NEEDS_HUMAN_REVIEW',
      'RECOVERY_ATTEMPTED',
      'RECOVERED',
      'RECOVERY_FAILED',
    ];
    const status = rng.pick(statusPool);

    transactions.push(
      createTx(
        index++,
        lossType,
        amount,
        paymentMethod,
        'STANDARD_STREAM',
        status,
        attemptCount,
        previousSuccess,
        {
          gateway_error_code: pickedReason.code,
          failure_reason_raw: pickedReason.reason,
          ...subInfo,
          ...invInfo,
        }
      )
    );
  }

  return transactions;
}