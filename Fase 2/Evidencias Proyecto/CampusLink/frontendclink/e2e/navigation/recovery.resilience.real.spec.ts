import { test, expect, responseAction } from '../fixtures/writes';
import { navigate } from '../helpers/navigation';
import { publishPhysical, openPhysical } from '../helpers/resources';

test.describe('Dependencias reales con fallos de transporte inyectados @real @resilience', () => {
  test('sin conexión: muestra error, conserva sesión y reintenta el catálogo', async ({ ui }) => {
    const page = await ui.page('receptor');
    test.info().annotations.push({ type: 'fault-injection', description: 'Playwright context.setOffline; API y Auth reales al recuperar la conexión.' });
    await page.context().setOffline(true);
    try {
      await navigate(page, 'Mercado');
      await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Perfil', exact: true })).toBeVisible();
    } finally { await page.context().setOffline(false); }
    await responseAction(page, 'GET', /\/marketplace\/physicalgoods$/, () => page.getByRole('button', { name: 'Reintentar', exact: true }).click());
    await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeHidden();
    await navigate(page, 'Perfil');
    await expect(page.getByText(ui.user('receptor').name, { exact: true }).first()).toBeVisible();
  });

  test('solicitud confirmada en servidor con respuesta perdida: una sola solicitud y aviso', async ({ ui }) => {
    const owner = await ui.page('propietario');
    const resource = await publishPhysical(owner, ui, 'Respuesta perdida');
    const receiver = await ui.page('receptor'); await openPhysical(receiver, resource);
    await receiver.getByRole('button', { name: 'Solicitar este recurso', exact: true }).click();
    await receiver.getByRole('radiogroup', { name: 'Mensajes disponibles', exact: true }).getByRole('radio').first().click();
    let committedId = '', writes = 0;
    const route = '**/api/v1/marketplace/physicalgoods/' + resource.id + '/requests';
    test.info().annotations.push({ type: 'fault-injection', description: 'route.fetch ejecuta el POST real; solo se pierde su respuesta al navegador.' });
    await receiver.route(route, async route => {
      if (route.request().method() !== 'POST') return route.continue();
      writes++; const response = await route.fetch(); expect(response.status()).toBe(201);
      committedId = (await response.json()).data.id;
      await route.abort('failed');
    });
    await receiver.getByRole('button', { name: 'Enviar solicitud', exact: true }).click();
    await expect(receiver.getByRole('heading', { name: 'Solicitud enviada', exact: true })).toBeVisible({ timeout: 60_000 });
    expect(writes).toBe(1); expect(committedId).toMatch(/^[a-f0-9-]{36}$/);
    await receiver.unroute(route);
    // Comprobar la persistencia desde otra cuenta por la interfaz, sin repetir el POST.
    await owner.reload(); await navigate(owner, 'Mercado');
    await owner.getByRole('button', { name: /^Mi actividad/ }).click();
    await owner.getByRole('tab', { name: /^Solicitudes/ }).click();
    await owner.getByRole('tab', { name: /^Recibidas/ }).click();
    await expect(owner.getByRole('button', { name: 'Ver 1 solicitud de ' + resource.title, exact: true })).toBeVisible();
    const notices = await responseAction(owner, 'GET', /\/users\/me\/notifications$/, () => navigate(owner, 'Perfil').then(() => owner.getByRole('link', { name: /^Notificaciones/ }).click()));
    expect(notices.items.filter((n: { type: string; publicationId: string }) => n.type === 'RESOURCE_REQUEST_RECEIVED' && n.publicationId === resource.id)).toHaveLength(1);
  });

  test('imagen firmada inaccesible: renueva el enlace y muestra bytes reales', async ({ ui }) => {
    test.skip(ui.manifest.apiOrigin.startsWith('https:'), 'El botón de recuperación se implementa en esta rama y aún no está desplegado en Render.');
    const page = await ui.page('propietario');
    const resource = await publishPhysical(page, ui, 'Renovación imagen');
    test.info().annotations.push({ type: 'fault-injection', description: 'Se bloquea la descarga de Storage; no se afirma haber esperado el TTL del proveedor.' });
    const signed = '**/storage/v1/object/sign/**';
    await page.route(signed, route => route.abort('failed'));
    await page.getByRole('button', { name: 'Ver imágenes publicadas', exact: true }).click();
    await expect(page.getByRole('heading', { name: resource.title, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Renovar enlace de la fotografía' })).toBeVisible();
    await page.unroute(signed);
    const downloaded = page.waitForResponse(r => new URL(r.url()).pathname.includes('/storage/v1/object/sign/') && r.status() === 200);
    await page.getByRole('button', { name: 'Renovar enlace de la fotografía' }).click();
    const image = await downloaded; expect((await image.body()).subarray(0, 4)).toEqual(Buffer.from([137, 80, 78, 71]));
    await expect(page.getByRole('img', { name: 'Fotografía de ' + resource.title })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Renovar enlace de la fotografía' })).toBeHidden();
  });
});
