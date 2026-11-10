import { test, expect } from '../fixtures/test';
import { login } from '../helpers/auth';
import { navigate } from '../helpers/navigation';

test.beforeEach(async ({ page }) => { await login(page); await navigate(page, 'Mercado'); });

test('catálogo, búsqueda con debounce y detalle @mock', async ({ page, api }) => {
  await expect(page.getByText('Calculadora científica', { exact: true })).toBeVisible();
  await page.getByLabel('Buscar recursos por nombre o descripción').fill('Calculadora');
  await expect.poll(() => api.calls.some(c => c.query.includes('q=Calculadora'))).toBe(true);
  await expect(page.getByText('Libro de programación', { exact: true })).toHaveCount(0);
  await page.getByText('Calculadora científica', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Descripción', exact: true })).toBeVisible();
  await expect(page.getByText(/Recurso sintético para explorar/)).toBeVisible();
});

test('búsqueda sin resultados @mock', async ({ page }) => {
  await page.getByLabel('Buscar recursos por nombre o descripción').fill('inexistente-qa');
  await expect(page.getByText('Sin coincidencias', { exact: true })).toBeVisible();
});

test('modalidad donación filtra y vuelve al catálogo completo @mock', async ({ page, api }) => {
  await expect(page.getByText('Calculadora científica', { exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Modalidad: Donación', exact: true }).click();
  await expect.poll(() => api.calls.some(c => c.query.includes('modality=DONACION'))).toBe(true);
  await expect(page.getByText('Calculadora científica', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Kit de dibujo técnico', { exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Modalidad: Todo', exact: true }).click();
  await expect(page.getByText('Calculadora científica', { exact: true })).toBeVisible();
});

test('error del catálogo se recupera al reintentar @mock', async ({ page, api }) => {
  await navigate(page, 'Biblioteca');
  api.state.catalogError = true;
  await navigate(page, 'Mercado');
  await expect(page.getByRole('alert')).toBeVisible();
  api.state.catalogError = false;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByText('Calculadora científica', { exact: true })).toBeVisible();
});

test('publicación valida datos sin escribir en servicios @mock', async ({ page, api }) => {
  await page.getByRole('button', { name: 'Publicar un recurso', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Publicar recurso', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publicar recurso', exact: true })).toBeDisabled();
  expect(api.calls.some(c => c.method === 'POST' && c.path === '/api/v1/marketplace/physicalgoods')).toBe(false);
});
