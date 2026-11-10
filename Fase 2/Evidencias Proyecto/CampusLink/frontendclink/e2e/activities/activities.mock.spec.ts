import { test, expect } from '../fixtures/test';
import { login } from '../helpers/auth';

test('actividades inscritas se abren desde el perfil @mock', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: /Mis actividades/ }).click();
  await expect(page.getByText('Taller de programación colaborativa', { exact: true })).toBeVisible();
  await expect(page.getByText('Grupo de estudio de algoritmos', { exact: true })).toBeVisible();
});
