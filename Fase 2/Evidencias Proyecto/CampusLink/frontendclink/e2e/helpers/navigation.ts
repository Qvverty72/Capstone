import { expect, type Page } from '@playwright/test';
export async function navigate(page: Page, name: 'Perfil' | 'Mercado' | 'Biblioteca' | 'Mapa') {
  await page.getByRole('tab', { name, exact: true }).click();
  await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
}
