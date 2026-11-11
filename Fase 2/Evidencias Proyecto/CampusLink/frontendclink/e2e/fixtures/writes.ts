import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { login } from '../helpers/auth';
import { installCspCheck, assertNoCspViolations } from '../helpers/csp';
import { isReal } from '../../qa/environment';

export type Actor = 'propietario' | 'receptor' | 'admin' | 'sujeto';
type User = { actor: Actor; id: string; name: string; email: string; password: string };
export type UIManifest = { kind: string; runId: string; prefix: string; campus: string; institution: string; apiOrigin: string; users: User[]; ready: boolean; cleaned?: boolean;
  registration?: { email: string; name: string; password: string; campus: string; campusName: string; institution: string } };
export type UIHarness = { manifest: UIManifest; user: (actor: Actor) => User; page: (actor: Actor) => Promise<Page>; title: (suffix: string) => string; file: (name: string) => string };

export const test = base.extend<{ ui: UIHarness }>({
  ui: async ({ browser }, use) => {
    base.skip(!isReal || !process.env.E2E_QA_WRITE_RUN, 'Solo test:e2e:write prepara una institución temporal autorizada.');
    const path = process.env.E2E_QA_WRITE_RUN!;
    const manifest: UIManifest = JSON.parse(await readFile(path, 'utf8'));
    expect(manifest.kind).toBe('campuslink-ui-qa-v1'); expect(manifest.ready).toBe(true); expect(manifest.cleaned).not.toBe(true);
    expect(manifest.users).toHaveLength(4);
    expect(manifest.users.every(u => u.email.endsWith(`.${manifest.runId}@campuslink.invalid`))).toBe(true);
    base.info().annotations.push({ type: 'qa-run', description: manifest.runId }, { type: 'target', description: manifest.apiOrigin });
    const contexts: BrowserContext[] = [], pages = new Map<Actor, Page>();
    const user = (actor: Actor) => manifest.users.find(u => u.actor === actor)!;
    try {
      await use({ manifest, user, title: suffix => `${manifest.prefix} ${suffix}`, file: name => resolve(dirname(path), 'files', name),
        page: async actor => {
          if (pages.has(actor)) return pages.get(actor)!;
          const context = await browser.newContext({ baseURL: base.info().project.use.baseURL, viewport: { width: 390, height: 844 }, serviceWorkers: 'block', acceptDownloads: true });
          contexts.push(context); const page = await context.newPage();
          await installCspCheck(page);
          page.setDefaultTimeout(15_000); page.setDefaultNavigationTimeout(60_000);
          page.on('response', response => {
            const url = new URL(response.url());
            if (response.status() >= 400 && url.pathname.startsWith('/api/v1/')) {
              console.error(JSON.stringify({ actor, method: response.request().method(), path: url.pathname, status: response.status() }));
            }
          });
          // La cuenta y la sesión se ejercitan por el formulario; no se inyectan cookies ni tokens.
          pages.set(actor, page); await login(page, user(actor)); return page;
        },
      });
    } finally {
      if (base.info().status !== base.info().expectedStatus) {
        for (const error of base.info().errors) {
          let message = error.message ?? 'Error sin mensaje';
          for (const user of manifest.users) message = message.replaceAll(user.password, '[credencial QA]');
          if (manifest.registration) message = message.replaceAll(manifest.registration.password, '[credencial QA]');
          console.error(message);
        }
        // Solo texto visible de las cuentas sintéticas del recorrido; excluye valores de inputs y sesiones.
        for (const [actor, page] of pages) {
          const text = await page.locator('body').innerText().catch(() => 'Página cerrada');
          await base.info().attach('interfaz-' + actor, { body: text.slice(0, 20000), contentType: 'text/plain' });
        }
      }
      try {
        for (const page of pages.values()) await assertNoCspViolations(page);
      } finally { for (const context of contexts) await context.close(); }
    }
  },
});
export { expect };

/** Espera la respuesta real que produce la acción UI, incluyendo respuestas de error. */
export async function responseAction(page: Page, method: string, path: RegExp, action: () => Promise<unknown>, status = 200) {
  const [response] = await Promise.all([page.waitForResponse(r => r.request().method() === method && path.test(new URL(r.url()).pathname), { timeout: 60_000 }), action()]);
  expect(response.status(), `${method} ${path}`).toBe(status);
  // Los rechazos se comprueban por estado y UI; no se vuelcan cuerpos de error.
  return status === 204 || status >= 400 ? undefined : (await response.json()).data;
}
export async function chooseFile(page: Page, button: string | RegExp, file: string | string[]) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: button, exact: typeof button === 'string' }).click()]);
  await chooser.setFiles(file);
}
