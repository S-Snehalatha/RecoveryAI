import { razorpayTestModeConfigured } from './client';
import { DemoExecutionAdapter } from './demoExecutionAdapter';
import { RazorpayExecutionAdapter } from './razorpayExecutionAdapter';
import { RecoveryExecutionAdapter } from './executionAdapter';

export function getExecutionAdapter(): RecoveryExecutionAdapter {
  const testMode = process.env.EXECUTION_MODE === 'RAZORPAY_TEST_MODE';
  if (testMode && !razorpayTestModeConfigured()) throw new Error('EXECUTION_MODE=RAZORPAY_TEST_MODE requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
  return testMode ? new RazorpayExecutionAdapter() : new DemoExecutionAdapter();
}
