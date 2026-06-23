import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: { headless: false }, // overridden per-test via --headless=new arg for CI
  timeout: 30000,
});
