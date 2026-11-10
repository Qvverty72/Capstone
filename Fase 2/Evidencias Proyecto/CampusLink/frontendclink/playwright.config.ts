import { defineConfig, devices } from '@playwright/test';
import { baseURL, isReal, LOCAL_WEB, requireQATarget } from './qa/environment';

if (isReal) requireQATarget();
export default defineConfig({
  testDir: './e2e',
  testIgnore: isReal ? '**/*.mock.spec.ts' : undefined,
  timeout: 45_000,
  expect: { timeout: 12_000 },
  fullyParallel: true,
  workers: 2,
  retries: 0,
  forbidOnly: true,
  outputDir: 'test-results',
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL,
    ...devices['Desktop Chrome'],
    viewport: { width: 390, height: 844 },
    actionTimeout: 12_000,
    navigationTimeout: 60_000,
    // Real QA artifacts can contain sessions and personal data; disabled there.
    screenshot: isReal ? 'off' : 'only-on-failure',
    trace: isReal ? 'off' : 'retain-on-failure',
    video: isReal ? 'off' : 'retain-on-failure',
    serviceWorkers: 'block',
  },
  projects: [{ name: isReal ? 'chromium-real-qa' : 'chromium-mocked-api' }],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run qa:web', url: LOCAL_WEB, timeout: 180_000,
    reuseExistingServer: false,
  },
});
