import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // The test suite shares the in-memory store and its persisted demo_state.json.
    // Run test files serially so one file cannot reset shared state while another is running.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
