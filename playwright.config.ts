import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // headless:false is a PERMANENT requirement, not a CI-only override: Playwright
  // rejects the extension-load args (--load-extension) unless headless is false.
  // Actual headless rendering comes from the --headless=new arg passed in the test.
  use: { headless: false },
  timeout: 30000,
});
