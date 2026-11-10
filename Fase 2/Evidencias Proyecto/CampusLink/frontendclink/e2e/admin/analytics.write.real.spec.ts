import { test, expect, responseAction } from '../fixtures/writes';
import { downloadFile } from '../helpers/downloads';

test('administrador guarda un reporte real y exporta PDF y Excel @real @write', async ({ ui }) => {
  const admin = await ui.page('admin');
  await admin.getByRole('link', { name: 'Analítica', exact: true }).click();
  await expect(admin.getByRole('button', { name: 'Guardar reporte', exact: true })).toBeEnabled();
  const report = await responseAction(admin, 'POST', /\/analytics\/reports$/, () => admin.getByRole('button', { name: 'Guardar reporte', exact: true }).click());
  expect(report.scope.institutionId).toBe(ui.manifest.institution);
  expect(report.generatedBy.userId).toBe(ui.user('admin').id);
  await expect(admin.getByRole('button', { name: /^Descargar PDF/ })).toBeVisible();
  const pdf = await downloadFile(admin, /^Descargar PDF/, 'pdf');
  const excel = await downloadFile(admin, /^Descargar Excel/, 'xlsx');
  expect(pdf.name).toMatch(/\.pdf$/); expect(excel.name).toMatch(/\.xlsx$/);
  const history = await responseAction(admin, 'GET', /\/analytics\/reports$/, () => admin.getByRole('link', { name: 'Reportes guardados', exact: true }).click());
  expect(history.items.some((item: { id: string }) => item.id === report.id)).toBe(true);
  const card = admin.getByTestId(`saved-report-${report.id}`);
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: /^Abrir / }).click();
  await expect(admin.getByRole('heading', { name: 'Descargar este reporte', exact: true })).toBeVisible();
});
