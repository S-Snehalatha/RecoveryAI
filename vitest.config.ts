import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The test suite shares the in-memory store and its persisted demo_state.json.
    // Run test files serially so one file cannot reset shared state while another is running.
    fileParallelism: false,
  },
});
