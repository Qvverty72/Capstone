import { test, expect, responseAction, chooseFile } from '../fixtures/writes';
import { publishPhysical, openPhysical } from '../helpers/resources';
import { requestResource, acceptRequest, confirmAgreement, rateAgreement } from '../helpers/agreements';

test('publicar con foto y editar un recurso físico desde la interfaz @real @write', async ({ ui }) => {
  const owner = await ui.page('propietario');
  const resource = await publishPhysical(owner, ui, 'Recurso físico editable');
  await owner.getByRole('button', { name: 'Ver imágenes publicadas', exact: true }).click();
  await owner.getByRole('button', { name: 'Administrar publicación', exact: true }).click();
  await owner.getByRole('button', { name: 'Editar datos', exact: true }).click();
  const title = resource.title + ' actualizado';
  await owner.getByLabel('Editar nombre del recurso').fill(title);
  await responseAction(owner, 'PATCH', new RegExp(`/physicalgoods/${resource.id}$`), () => owner.getByRole('button', { name: 'Guardar cambios', exact: true }).click());
  await owner.getByRole('button', { name: 'Gestionar fotos', exact: true }).click();
  await chooseFile(owner, /Seleccionar fotos/, ui.file('imagen.png'));
  await responseAction(owner, 'POST', new RegExp(`/physicalgoods/${resource.id}/images$`), () => owner.getByRole('button', { name: 'Guardar fotos nuevas', exact: true }).click(), 201);
  await expect(owner.getByText('Fotos publicadas · 2/3', { exact: true })).toBeVisible();
  // El modal ofrece cierre por fondo y por cabecera; elegir el botón de la cabecera.
  await owner.getByRole('button', { name: 'Cerrar administración de publicación', exact: true }).last().click();
  await expect(owner.getByRole('heading', { name: title, exact: true })).toBeVisible();
});

test('solicitud física, aceptación, doble confirmación y valoración por interfaz @real @write', async ({ ui }) => {
  const owner = await ui.page('propietario'), receiver = await ui.page('receptor');
  const resource = await publishPhysical(owner, ui, 'Intercambio físico');
  await openPhysical(receiver, resource);
  await requestResource(receiver, resource);
  const transaction = await acceptRequest(owner, ui, resource);
  await confirmAgreement(owner, resource, transaction);
  const completed = await confirmAgreement(receiver, resource, transaction);
  expect(completed.status ?? completed.transaction?.status).toBe('COMPLETADA');
  await rateAgreement(receiver, resource, transaction);
});

test('propietario retira una publicación física y desaparece del catálogo @real @write', async ({ ui }) => {
  const owner = await ui.page('propietario'), receiver = await ui.page('receptor');
  const resource = await publishPhysical(owner, ui, 'Recurso para retirar');
  await owner.getByRole('button', { name: 'Ver imágenes publicadas', exact: true }).click();
  await owner.getByRole('button', { name: 'Administrar publicación', exact: true }).click();
  await owner.getByRole('button', { name: 'Retirar publicación', exact: true }).click();
  await responseAction(owner, 'DELETE', new RegExp(`/physicalgoods/${resource.id}$`), () => owner.getByRole('button', { name: 'Confirmar retirada de publicación', exact: true }).click());
  await receiver.getByRole('tab', { name: 'Mercado', exact: true }).click();
  await receiver.getByLabel('Buscar recursos por nombre o descripción').fill(resource.title);
  await expect(receiver.getByText('Sin coincidencias', { exact: true })).toBeVisible();
});
