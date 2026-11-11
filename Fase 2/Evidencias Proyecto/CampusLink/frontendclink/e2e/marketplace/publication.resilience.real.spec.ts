import { test, expect, responseAction, chooseFile } from '../fixtures/writes';
import { navigate } from '../helpers/navigation';
import { readFile } from 'node:fs/promises';

for (const kind of ['physicalgoods', 'elibrary'] as const) {
  test(`publicación ${kind}: respuesta real perdida y reintento sin duplicados @real @resilience`, async ({ ui }) => {
    test.skip(ui.manifest.apiOrigin.startsWith('https:'), 'La idempotencia de publicación está en esta rama y todavía no se despliega en Render.');
    const page = await ui.page('propietario'), physical = kind === 'physicalgoods';
    await navigate(page, physical ? 'Mercado' : 'Biblioteca');
    await page.getByRole('button', { name: 'Publicar un recurso', exact: true }).click();
    const title = ui.title('Reintento ' + kind);
    await page.getByLabel(physical ? 'Nombre del recurso' : 'Título', { exact: true }).fill(title);
    await page.getByLabel(physical ? 'Descripción del recurso' : 'Descripción', { exact: true }).fill('Material sintético para verificar un reintento de publicación');
    if (physical) {
      await page.getByRole('button', { name: 'Seleccionar condición *', exact: true }).click();
      await page.getByRole('radio', { name: 'Condición *: Buen estado', exact: true }).click();
      await page.getByRole('button', { name: 'Seleccionar categoría *', exact: true }).click();
      await page.getByRole('radiogroup', { name: 'Opciones de categoría *', exact: true }).getByRole('radio').first().click();
    }
    await page.getByRole('radio', { name: 'Donación', exact: true }).click();
    await chooseFile(page, physical ? /Agregar imágenes/ : /Seleccionar archivos PDF/, ui.file(physical ? 'imagen.png' : 'material.pdf'));
    let original = '', operation = '', attempts = 0;
    const endpoint = '**/api/v1/marketplace/' + kind;
    test.info().annotations.push({ type: 'fault-injection', description: 'El primer POST escribe en la API real y pierde su respuesta. En multipart se reponen los bytes del mismo PDF QA seleccionado: Chromium omite los archivos en postData de solicitudes interceptadas.' });
    await page.route(endpoint, async route => {
      if (route.request().method() !== 'POST') return route.continue();
      attempts++; operation = route.request().headers()['idempotency-key'];
      let response;
      if (physical) response = await route.fetch();
      else {
        const headers = { ...route.request().headers() };
        const form = await new Response(new Uint8Array(route.request().postDataBuffer()!), { headers: { 'Content-Type': headers['content-type'] } }).formData() as unknown as { get(name: string): string | File | null };
        const selected = form.get('file') as File;
        delete headers['content-type']; delete headers['content-length'];
        response = await page.request.post(route.request().url(), { headers, multipart: {
          metadata: String(form.get('metadata')), file: { name: selected.name, mimeType: 'application/pdf', buffer: await readFile(ui.file('material.pdf')) },
        } });
      }
      if (response.status() !== 201) {
        const rejected = await response.json();
        throw new Error(`Publicación QA rechazada: ${response.status()} ${rejected.error?.code} ${rejected.error?.message}`);
      }
      original = (await response.json()).data.id;
      await route.abort('failed');
    });
    const submit = page.getByRole('button', { name: physical ? 'Publicar recurso' : 'Publicar recurso digital', exact: true });
    await submit.click();
    await expect(page.getByText(/No se pudo publicar|No se pudo completar|conexión|conexión con el servidor/i).first()).toBeVisible({ timeout: 60000 });
    expect(attempts).toBe(1); expect(operation).toMatch(/^[a-f0-9-]{36}$/i); expect(original).toMatch(/^[a-f0-9-]{36}$/i);
    await page.unroute(endpoint);
    const retry = await responseAction(page, 'POST', new RegExp('/marketplace/' + kind + '$'), () => submit.click(), 201);
    expect(retry.id).toBe(original);
    // The normal authenticated list is read through the UI; count only this run's exact title.
    await page.reload();
    const data = await responseAction(page, 'GET', new RegExp('/marketplace/' + kind + '$'), () => navigate(page, physical ? 'Mercado' : 'Biblioteca'));
    const items = Array.isArray(data) ? data : data.items;
    expect(items.filter((item: { title: string }) => item.title === title)).toHaveLength(1);
  });
}
