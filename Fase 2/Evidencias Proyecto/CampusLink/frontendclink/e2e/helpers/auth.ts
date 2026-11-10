import { expect, type Page } from '@playwright/test';
import { email, password } from '../fixtures/data';

/** Always exercise the application's real form and Supabase session handling. */
export async function login(page: Page, credentials = { email, password }) {
  await page.goto('/login');
  await page.getByLabel('Correo', { exact: true }).fill(credentials.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Perfil', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/profile$/);
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Abrir opciones de cuenta' }).click();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible();
}
