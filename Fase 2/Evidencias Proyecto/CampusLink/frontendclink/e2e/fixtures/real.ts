import { test as base, expect } from '@playwright/test';
import { isReal } from '../../qa/environment';
import { login } from '../helpers/auth';
import { installCspCheck, assertNoCspViolations } from '../helpers/csp';

export const test = base.extend({
  page: async ({ page }, use) => {
    base.skip(!isReal || !process.env.E2E_QA_EMAIL || !process.env.E2E_QA_PASSWORD || !process.env.E2E_QA_DATA,
      'Requiere test:e2e:real y el manifiesto sintético autorizado; no utiliza mocks ni cuentas personales.');
    await installCspCheck(page);
    await login(page, { email: process.env.E2E_QA_EMAIL!, password: process.env.E2E_QA_PASSWORD! });
    await use(page);
    await assertNoCspViolations(page);
  },
});
export { expect };
export function realData() {
  return JSON.parse(process.env.E2E_QA_DATA!) as { publications: { key: string; title: string }[]; activityTitle: string };
}
