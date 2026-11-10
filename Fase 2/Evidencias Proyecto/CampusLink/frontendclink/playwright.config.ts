import { defineConfig, devices } from '@playwright/test';
import { baseURL, isReal, LOCAL_WEB, requireQATarget } from './qa/environment';

if (isReal) requireQATarget();
const writing = isReal && Boolean(process.env.E2E_QA_WRITE_RUN);
export default defineConfig({
  testDir: './e2e',
  testMatch: writing ? '**/*.write.real.spec.ts' : undefined,
  testIgnore: isReal ? (writing ? '**/*.mock.spec.ts' : ['**/*.mock.spec.ts', '**/*.write.real.spec.ts']) : '**/*.write.real.spec.ts',
  timeout: writing ? 180_000 : 45_000,
  expect: { timeout: 12_000 },
  fullyParallel: !writing,
  workers: 2,
  retries: 0,
  forbidOnly: true,
  outputDir: process.env.E2E_REPORT_DIR ? `${process.env.E2E_REPORT_DIR}/test-results` : 'test-results',
  reporter: [['list'], ['html', { open: 'never', ...(process.env.E2E_REPORT_DIR ? { outputFolder: `${process.env.E2E_REPORT_DIR}/html` } : {}) }], ['json', { outputFile: process.env.E2E_REPORT_DIR ? `${process.env.E2E_REPORT_DIR}/results.json` : 'test-results/results.json' }]],
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
