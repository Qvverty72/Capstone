import { test, expect } from '../fixtures/test';
import { login } from '../helpers/auth';
import { navigate } from '../helpers/navigation';

test('rutas protegidas y permisos sin sesión @mock', async ({ page }) => {
  for (const route of ['/profile', '/physicalgoods', '/elibrary', '/analytics', '/reports']) {
    await page.goto(route);
    await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible();
  }
});

test('navegación principal y administración oculta para estudiante @mock', async ({ page }) => {
  await login(page);
  await expect(page.getByText('ADMINISTRACIÓN', { exact: true })).toHaveCount(0);
  await navigate(page, 'Mercado');
  await expect(page.getByRole('heading', { name: 'Mercado', exact: true })).toBeVisible();
  await navigate(page, 'Biblioteca');
  await expect(page.getByRole('heading', { name: 'Biblioteca', exact: true })).toBeVisible();
  await navigate(page, 'Perfil');
  await page.getByRole('link', { name: 'Notificaciones', exact: true }).click();
  await expect(page.getByText(/No tienes notificaciones/)).toBeVisible();
});

test('mapa muestra error de servicio y permite reintentar @mock', async ({ page, api }) => {
  await login(page);
  await navigate(page, 'Mapa');
  const retry = page.getByRole('button', { name: 'Reintentar', exact: true });
  await expect(retry).toBeVisible();
  const count = api.calls.filter(call => call.path.includes('/maps/')).length;
  await retry.click();
  await expect.poll(() => api.calls.filter(call => call.path.includes('/maps/')).length).toBeGreaterThan(count);
});

test('OpenGL/Expo GL nativo requiere dispositivo; fuera de Chromium @native', async () => {
  test.skip(true, 'Playwright Web no ejecuta UIKit/Android ni certifica Expo GL nativo. Ver src/three/components/CampusMapViewport.tsx.');
});
