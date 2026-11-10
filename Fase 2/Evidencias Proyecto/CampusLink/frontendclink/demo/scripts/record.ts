import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { baseURL, isReal } from '../../qa/environment';
import { startDemoServer } from '../../qa/server';
import { installMockAPI } from '../../e2e/fixtures/mock-api';
import { walkthrough } from '../scenarios/campuslink';
import { buildVideo } from './build';

async function main() {
  if (isReal) throw new Error('Public demo only supports isolated synthetic fixtures; real sessions must never be recorded.');
  const artifacts = resolve('demo/.artifacts');
  const output = resolve('../docs/demo');
  await mkdir(artifacts, { recursive: true }); await mkdir(output, { recursive: true });
  const stopServer = await startDemoServer(resolve(artifacts, 'web-server.log'));
  try {
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1,
        recordVideo: { dir: artifacts, size: { width: 1280, height: 720 } }, serviceWorkers: 'block' });
      const api = await installMockAPI(context, new URL(baseURL).origin);
      const html = await readFile(resolve('demo/composition.html'), 'utf8');
      const born = Date.now();
      const page = await context.newPage();
      await page.route('**/__campuslink_demo__', route => route.fulfill({ contentType: 'text/html', body: html }));
      await page.goto(baseURL + '/__campuslink_demo__');
      const app = page.frameLocator('iframe');
      await expect(app.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible({ timeout: 120_000 });
      const leadInSeconds = Math.max(0, (Date.now() - born) / 1000 - 0.15);
      const result = await walkthrough(page, app, resolve(artifacts, 'thumbnail.png'));
      if (api.unexpected.length) throw new Error('Unimplemented requests: ' + api.unexpected.join(', '));
      await expect(app.getByRole('alert')).toHaveCount(0);
      const video = page.video()!;
      await context.close();
      const rawVideo = await video.path();
      await writeFile(resolve(artifacts, 'recording.json'), JSON.stringify({ rawVideo, leadInSeconds, ...result, mode: 'mocked-api',
        modules: ['Acceso institucional', 'Perfil', 'Actividades personales', 'Mercado: catálogo, modalidad y detalle', 'Biblioteca: búsqueda y vista previa'],
      }, null, 2));
      if (!process.argv.includes('--capture-only')) await buildVideo();
    } finally { await browser.close(); }
  } finally { await stopServer(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
