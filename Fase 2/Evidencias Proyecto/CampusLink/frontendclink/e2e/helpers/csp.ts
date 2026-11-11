import { expect, type Page } from '@playwright/test';
type CspWindow = Window & { qaCspViolations?: string[] };
export async function installCspCheck(page: Page) {
  if (process.env.E2E_STATIC_WEB !== '1') return;
  await page.addInitScript(() => {
    (window as CspWindow).qaCspViolations = [];
    window.addEventListener('securitypolicyviolation', event => {
      let target = event.blockedURI;
      const origin = target.match(/^https?:\/\/([^/?#]+)/)?.[0];
      const scheme = target.match(/^[a-z][a-z0-9+.-]*:/i)?.[0];
      target = origin ?? scheme ?? (['eval','inline','wasm-eval'].includes(target) ? target : 'other');
      const source = event.sourceFile.split('/').at(-1)?.split('?')[0] ?? '';
      (window as CspWindow).qaCspViolations?.push(event.effectiveDirective + ': ' + target + ' (' + source + ':' + event.lineNumber + ')');
    });
  });
}
export async function assertNoCspViolations(page: Page) {
  if (process.env.E2E_STATIC_WEB === '1') expect(await page.evaluate(() => (window as CspWindow).qaCspViolations ?? []),
    'Sin infracciones CSP en la aplicación exportada').toEqual([]);
}
