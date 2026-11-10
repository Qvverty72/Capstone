import { test, expect, responseAction } from '../fixtures/writes';
import { publishPhysical, openPhysical } from '../helpers/resources';

for (const accept of [false, true]) {
  test(`denuncia real: administrador ${accept ? 'acoge y oculta' : 'desestima'} contenido QA @real @write`, async ({ ui }) => {
    const owner = await ui.page('propietario'), receiver = await ui.page('receptor'), admin = await ui.page('admin');
    const resource = await publishPhysical(owner, ui, accept ? 'Denuncia para ocultar' : 'Denuncia para desestimar');
    await openPhysical(receiver, resource);
    await receiver.getByRole('button', { name: 'Denunciar recurso', exact: true }).click();
    await receiver.getByRole('radiogroup', { name: 'Motivos de la denuncia', exact: true }).getByRole('radio').first().click();
    await receiver.getByLabel('Descripción de la denuncia', { exact: true }).fill('Denuncia sintética para comprobar la resolución administrativa');
    const report = await responseAction(receiver, 'POST', new RegExp(`/reports/physicalgoods/${resource.id}$`), () => receiver.getByRole('button', { name: 'Enviar denuncia', exact: true }).click(), 201);
    expect(report.id).toBeTruthy();
    await admin.getByRole('link', { name: 'Denuncias de contenido', exact: true }).click();
    await admin.getByRole('button', { name: new RegExp(resource.title) }).click();
    await admin.getByRole('radio', { name: accept ? 'Acoger y ocultar contenido' : 'Desestimar denuncia', exact: true }).click();
    await admin.getByLabel('Justificación de la resolución', { exact: true }).fill('Resolución sintética del recorrido QA con datos temporales');
    await admin.getByRole('button', { name: 'Revisar decisión', exact: true }).click();
    const resolved = await responseAction(admin, 'POST', new RegExp(`/reports/campuses/${ui.manifest.campus}/${report.id}/resolution$`), () => admin.getByRole('button', { name: accept ? 'Confirmar y ocultar' : 'Confirmar desestimación', exact: true }).click());
    expect(resolved).toBeTruthy();
    await expect(admin.getByText('Resolución registrada', { exact: true })).toBeVisible();
    await expect(admin.getByText(accept ? 'Contenido ocultado' : 'Ninguna medida sobre el contenido', { exact: true })).toBeVisible();
    // La comprobación final vuelve a recorrer el catálogo de otro usuario.
    await receiver.reload();
    await receiver.getByRole('tab', { name: 'Mercado', exact: true }).click();
    await receiver.getByLabel('Buscar recursos por nombre o descripción').fill(resource.title);
    if (accept) await expect(receiver.getByText('Sin coincidencias', { exact: true })).toBeVisible();
    else await expect(receiver.getByText(resource.title, { exact: true })).toBeVisible();
  });
}
