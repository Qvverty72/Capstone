import { test, expect } from '@playwright/test';
import { login, logout } from '../helpers/auth';
import { isReal } from '../../qa/environment';

test.use({ screenshot: 'off', trace: 'off', video: 'off' });

test('login QA real, continuidad y logout @real', async ({ page }) => {
  test.skip(!isReal || !process.env.E2E_QA_EMAIL || !process.env.E2E_QA_PASSWORD,
    'Se requieren E2E_QA_EMAIL y E2E_QA_PASSWORD de una cuenta QA autorizada; no se usan cuentas personales.');
  await login(page, { email: process.env.E2E_QA_EMAIL!, password: process.env.E2E_QA_PASSWORD! });
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Perfil', exact: true })).toBeVisible();
  await logout(page);
});
