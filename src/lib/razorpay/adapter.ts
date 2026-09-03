import { razorpayTestModeConfigured } from './client';
import { DemoExecutionAdapter } from './demoExecutionAdapter';
import { RazorpayExecutionAdapter } from './razorpayExecutionAdapter';
import { RecoveryExecutionAdapter } from './executionAdapter';

export function getExecutionAdapter(): RecoveryExecutionAdapter {
  return razorpayTestModeConfigured()
    ? new RazorpayExecutionAdapter()
    : new DemoExecutionAdapter();
}
