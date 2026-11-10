import { test, expect } from '../fixtures/test';
import { email, password } from '../fixtures/data';
import { login, logout } from '../helpers/auth';

test('login accesible, campos obligatorios y enlaces @mock', async ({ page, api }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByText('Ingresa tu correo y contraseña.', { exact: true })).toBeVisible();
  expect(api.calls.some(call => call.path.endsWith('/login'))).toBe(false);
  await page.getByRole('link', { name: 'Olvidé mi contraseña' }).click();
  await expect(page).toHaveURL(/\/recover$/);
});

test('rechaza credenciales inválidas y limpia contraseña @mock', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Correo', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill('invalid-synthetic');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByText(/No se pudo iniciar sesión. Revisa tus credenciales/)).toBeVisible();
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveValue('');
  await expect(page).toHaveURL(/\/login$/);
});

test('sesión persiste tras recarga y logout retira rutas @mock', async ({ page }) => {
  await login(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Estudiante CampusLink' })).toBeVisible();
  await logout(page);
  await page.goto('/elibrary');
  await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Biblioteca' })).toHaveCount(0);
});

test('cuenta suspendida muestra rechazo confirmado por /me @mock', async ({ page, api }) => {
  api.state.denyAccount = true;
  await page.goto('/login');
  await page.getByLabel('Correo', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Tu cuenta está suspendida.');
  await expect(page.getByRole('tab', { name: 'Mercado' })).toHaveCount(0);
});
