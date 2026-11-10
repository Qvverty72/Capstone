import { test, expect } from '../fixtures/test';
import { login } from '../helpers/auth';
import { navigate } from '../helpers/navigation';

test.beforeEach(async ({ page }) => { await login(page); await navigate(page, 'Biblioteca'); });

test('biblioteca busca y muestra detalle con vista previa @mock', async ({ page }) => {
  await expect(page.getByText('Guía de programación TypeScript', { exact: true })).toBeVisible();
  await page.getByPlaceholder('Buscar apuntes, guías, resúmenes…').fill('TypeScript');
  await expect(page.getByText('Apuntes de bases de datos', { exact: true })).toHaveCount(0);
  await page.getByText('Guía de programación TypeScript', { exact: true }).click();
  await expect(page.getByText(/Tipos, funciones y trabajo colaborativo/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Guía de programación TypeScript', exact: true })).toBeVisible();
});

test('formulario digital valida campos antes de publicar @mock', async ({ page, api }) => {
  await page.getByRole('button', { name: 'Publicar un recurso', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Publicar recurso digital', exact: true })).toBeDisabled();
  const choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Seleccionar archivos PDF/ }).click();
  await (await choosing).setFiles({ name: 'guia-qa.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') });
  await page.getByRole('button', { name: 'Publicar recurso digital', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Completa título, descripción');
  await page.getByLabel('Título', { exact: true }).fill('Guía 🚫');
  await page.getByRole('button', { name: 'Publicar recurso digital', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Elimina los símbolos' }).first()).toBeVisible();
  expect(api.calls.some(c => c.method === 'POST' && c.path === '/api/v1/marketplace/elibrary')).toBe(false);
});
