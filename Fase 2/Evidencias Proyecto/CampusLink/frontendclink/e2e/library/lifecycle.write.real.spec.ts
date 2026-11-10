import { test, expect, responseAction } from '../fixtures/writes';
import { publishDigital, openDigital } from '../helpers/resources';
import { requestResource, acceptRequest, confirmAgreement, rateAgreement } from '../helpers/agreements';
import { downloadFile } from '../helpers/downloads';
import { readFile } from 'node:fs/promises';

test('publicar PDF, editar, adquirir con doble confirmación y descargar original @real @write', async ({ ui }) => {
  const owner = await ui.page('propietario'), receiver = await ui.page('receptor');
  const resource = await publishDigital(owner, ui, 'Material digital');
  await expect(owner.getByRole('heading', { name: resource.title, exact: true })).toBeVisible();
  await owner.getByRole('button', { name: 'Administrar publicación', exact: true }).click();
  await owner.getByRole('button', { name: 'Editar datos', exact: true }).click();
  resource.title += ' actualizado';
  await owner.getByLabel('Editar título digital').fill(resource.title);
  await responseAction(owner, 'PATCH', new RegExp(`/elibrary/${resource.id}$`), () => owner.getByRole('button', { name: 'Guardar cambios', exact: true }).click());
  await owner.getByRole('button', { name: 'Cerrar administración de publicación digital', exact: true }).last().click();
  await expect(owner.getByRole('heading', { name: resource.title, exact: true })).toBeVisible();
  await openDigital(receiver, resource);
  await requestResource(receiver, resource, true);
  const transaction = await acceptRequest(owner, ui, resource, true);
  await confirmAgreement(owner, resource, transaction, true);
  const completed = await confirmAgreement(receiver, resource, transaction, true);
  expect(completed.status ?? completed.transaction?.status).toBe('COMPLETADA');
  await rateAgreement(receiver, resource, transaction, true);
  await receiver.getByRole('button', { name: 'Listo', exact: true }).click();
  await receiver.getByRole('tab', { name: 'Adquiridos', exact: true }).click();
  await receiver.getByRole('button', { name: new RegExp(resource.title) }).click();
  const download = await downloadFile(receiver, 'Descargar archivo completo', 'pdf');
  expect(download.bytes.equals(await readFile(ui.file('material.pdf')))).toBe(true);
});

test('publicar varios PDF y retirar el recurso digital desde su administración @real @write', async ({ ui }) => {
  const owner = await ui.page('propietario'), receiver = await ui.page('receptor');
  const resource = await publishDigital(owner, ui, 'Material digital para retirar', ['material.pdf', 'unidad2.pdf']);
  await expect(owner.getByRole('heading', { name: resource.title, exact: true })).toBeVisible();
  await owner.getByRole('button', { name: 'Administrar publicación', exact: true }).click();
  await owner.getByRole('button', { name: 'Gestionar archivos', exact: true }).click();
  await expect(owner.getByRole('button', { name: 'Descargar material.pdf', exact: true })).toBeVisible();
  await expect(owner.getByRole('button', { name: 'Descargar unidad2.pdf', exact: true })).toBeVisible();
  await owner.getByRole('button', { name: 'Volver a opciones de publicación', exact: true }).click();
  await owner.getByRole('button', { name: 'Retirar publicación', exact: true }).click();
  await responseAction(owner, 'DELETE', new RegExp(`/elibrary/${resource.id}$`), () => owner.getByRole('button', { name: 'Confirmar retirada digital', exact: true }).click());
  await receiver.getByRole('tab', { name: 'Biblioteca', exact: true }).click();
  await receiver.getByPlaceholder('Buscar apuntes, guías, resúmenes…').fill(resource.title);
  await expect(receiver.getByText('Sin coincidencias', { exact: true })).toBeVisible();
});
