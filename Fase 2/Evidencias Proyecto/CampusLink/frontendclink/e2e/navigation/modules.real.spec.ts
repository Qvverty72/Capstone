import { test, expect, realData } from '../fixtures/real';
import { navigate } from '../helpers/navigation';

test('mercado real: búsqueda, detalle e imagen privada @real', async ({ page }) => {
  await navigate(page, 'Mercado');
  const title = realData().publications.find(p => p.key === 'physical-05')!.title;
  const response = page.waitForResponse(r => r.url().includes('/marketplace/physicalgoods?') && r.url().includes('q=') && r.status() === 200);
  await page.getByLabel('Buscar recursos por nombre o descripción').fill(title);
  await response;
  const gallery = page.waitForResponse(r => /\/physicalgoods\/[^/]+\/images/.test(r.url()) && r.status() === 200);
  await page.getByText(title, { exact: true }).click();
  await gallery;
  await expect(page.getByRole('heading', { name: 'Descripción', exact: true })).toBeVisible();
  await expect(page.getByText(/Recurso sintético de prueba QA/)).toBeVisible();
  await expect.poll(() => page.locator('img[src*="/publication-images/"]').evaluateAll(images => images.filter(img => img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0).length)).toBeGreaterThan(0);
});

test('biblioteca real: búsqueda y vista previa PDF @real', async ({ page }) => {
  await navigate(page, 'Biblioteca');
  const title = realData().publications.find(p => p.key === 'digital-05')!.title;
  const response = page.waitForResponse(r => r.url().includes('/marketplace/elibrary?') && r.url().includes('q=') && r.status() === 200);
  await page.getByPlaceholder('Buscar apuntes, guías, resúmenes…').fill(title);
  await response;
  const preview = page.waitForResponse(r => /\/elibrary\/[^/]+\/files\/[^/]+\/preview/.test(r.url()));
  await page.getByText(title, { exact: true }).first().click();
  const result = await preview;
  expect(result.status()).toBe(200);
  expect(await result.json()).toMatchObject({ data: { available: true } });
  await expect(page.getByText(/CampusLink.*Material QA/).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(/Recurso sintético de prueba QA/)).toBeVisible();
});

test('actividades reales inscritas desde el perfil @real', async ({ page }) => {
  await page.getByRole('link', { name: /Mis actividades/ }).click();
  await expect(page.getByText(realData().activityTitle, { exact: true })).toBeVisible();
});

test('notificaciones y permisos del receptor QA @real', async ({ page }) => {
  await expect(page.getByText('ADMINISTRACIÓN', { exact: true })).toHaveCount(0);
  const response = page.waitForResponse(r => r.url().includes('/notifications') && r.request().method() === 'GET' && r.status() === 200);
  await page.getByRole('link', { name: /^Notificaciones/ }).click();
  await response;
  await expect(page.getByText('Notificaciones', { exact: true }).first()).toBeVisible();
});

test('mapa real: WebGL y controles de actividades @real', async ({ page }) => {
  const response = page.waitForResponse(r => /\/maps\/[^/]+\/active/.test(r.url()));
  await navigate(page, 'Mapa');
  expect((await response).status()).toBe(200);
  const unavailable = page.getByRole('alert').filter({ hasText: 'El mapa 3D no está disponible' });
  await expect(page.locator('canvas').or(unavailable).first()).toBeVisible({ timeout: 30_000 });
  if (await unavailable.isVisible()) test.skip(true, 'La API del mapa respondió 200, pero este navegador no pudo inicializar la escena WebGL; no certifica Expo GL nativo.');
  await expect(page.locator('canvas').first()).toBeVisible();
  const size = await page.locator('canvas').first().evaluate(c => ({ width: (c as HTMLCanvasElement).width, height: (c as HTMLCanvasElement).height }));
  expect(size.width).toBeGreaterThan(0); expect(size.height).toBeGreaterThan(0);
  await page.getByRole('button', { name: /^Eventos oficiales/ }).click();
  await expect(page.getByText(realData().activityTitle, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar actividades', exact: true }).click();
  await expect(page.locator('canvas').first()).toBeVisible();
});
