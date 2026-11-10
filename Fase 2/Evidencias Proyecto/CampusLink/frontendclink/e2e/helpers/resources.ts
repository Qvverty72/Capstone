import { type Page } from '@playwright/test';
import { expect, responseAction, chooseFile, type UIHarness } from '../fixtures/writes';
import { navigate } from './navigation';

export type Resource = { id: string; title: string };
export async function publishPhysical(page: Page, ui: UIHarness, suffix: string): Promise<Resource> {
  await navigate(page, 'Mercado');
  await page.getByRole('button', { name: 'Publicar un recurso', exact: true }).click();
  const title = ui.title(suffix);
  await page.getByLabel('Nombre del recurso', { exact: true }).fill(title);
  await page.getByLabel('Descripción del recurso', { exact: true }).fill('Recurso sintético para pruebas de interfaz sin uso comercial');
  await page.getByRole('button', { name: 'Seleccionar condición *', exact: true }).click();
  await page.getByRole('radio', { name: 'Condición *: Buen estado', exact: true }).click();
  await page.getByRole('button', { name: 'Seleccionar categoría *', exact: true }).click();
  await page.getByRole('radiogroup', { name: 'Opciones de categoría *', exact: true }).getByRole('radio').first().click();
  await page.getByRole('radio', { name: 'Donación', exact: true }).click();
  await chooseFile(page, /Agregar imágenes/, ui.file('imagen.png'));
  const created = await responseAction(page, 'POST', /\/marketplace\/physicalgoods$/, () => page.getByRole('button', { name: 'Publicar recurso', exact: true }).click(), 201);
  expect(created.title).toBe(title);
  await expect(page.getByText('Recurso publicado', { exact: false }).first()).toBeVisible();
  return { id: created.id, title };
}
export async function openPhysical(page: Page, resource: Resource) {
  await navigate(page, 'Mercado');
  await page.getByLabel('Buscar recursos por nombre o descripción').fill(resource.title);
  await page.getByText(resource.title, { exact: true }).first().click();
  await expect(page.getByRole('heading', { name: resource.title, exact: true })).toBeVisible();
}
export async function publishDigital(page: Page, ui: UIHarness, suffix: string, files = ['material.pdf']): Promise<Resource> {
  await navigate(page, 'Biblioteca');
  await page.getByRole('button', { name: 'Publicar un recurso', exact: true }).click();
  const title = ui.title(suffix);
  await page.getByLabel('Título', { exact: true }).fill(title);
  await page.getByLabel('Descripción', { exact: true }).fill('Material sintético para pruebas de biblioteca y adquisición');
  await page.getByRole('radio', { name: 'Donación', exact: true }).click();
  await chooseFile(page, /Seleccionar archivos PDF/, files.map(file => ui.file(file)));
  const created = await responseAction(page, 'POST', /\/marketplace\/elibrary$/, () => page.getByRole('button', { name: 'Publicar recurso digital', exact: true }).click(), 201);
  expect(created.title).toBe(title);
  return { id: created.id, title };
}
export async function openDigital(page: Page, resource: Resource) {
  await navigate(page, 'Biblioteca');
  await page.getByPlaceholder('Buscar apuntes, guías, resúmenes…').fill(resource.title);
  await page.getByText(resource.title, { exact: true }).first().click();
  await expect(page.getByRole('heading', { name: resource.title, exact: true })).toBeVisible();
}
