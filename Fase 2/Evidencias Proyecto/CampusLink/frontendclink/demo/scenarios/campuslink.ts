import { expect, type FrameLocator, type Locator, type Page } from '@playwright/test';
import { setTimeout as delay } from 'node:timers/promises';
import { email, password } from '../../e2e/fixtures/data';

export const chapters = [
  ['CampusLink', 'Tu comunidad universitaria,\nen un solo lugar.'],
  ['Acceso institucional', 'Formulario real y manejo de sesión.\nIdentidad preparada para QA.'],
  ['Tu perfil', 'Accesos personales y navegación\nentre los módulos de CampusLink.'],
  ['Actividades del campus', 'Consulta tus inscripciones,\nfechas y espacios de encuentro.'],
  ['Mercado estudiantil', 'Explora recursos físicos,\nventa y donación entre estudiantes.'],
  ['Biblioteca digital', 'Busca material académico\ny consulta el detalle del recurso.'],
  ['Comunidad conectada', 'CampusLink\nProyecto Capstone · Duoc UC'],
] as const;

/** Presentation pacing is intentional. Assertions wait for real visible UI state. */
export async function walkthrough(page: Page, app: FrameLocator, screenshot: string) {
  const timeline: { chapter: string; atSeconds: number }[] = [];
  const started = Date.now();
  async function chapter(index: number) {
    timeline.push({ chapter: chapters[index][0], atSeconds: (Date.now() - started) / 1000 });
    await page.evaluate(({ title, copy, index }) => {
      document.getElementById('title')!.textContent = title;
      document.getElementById('copy')!.textContent = copy;
      document.getElementById('number')!.textContent = String(index).padStart(2, '0');
      document.querySelectorAll('.step').forEach((node, i) => node.classList.toggle('active', i === index));
      document.getElementById('chapter')!.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 450, fill: 'both' });
    }, { title: chapters[index][0], copy: chapters[index][1], index });
  }
  async function click(target: Locator) {
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (!box) throw new Error('Demo target has no visible bounds');
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.evaluate(({ x, y }) => {
      const pointer = document.getElementById('pointer')!;
      pointer.style.opacity = '1'; pointer.style.transform = `translate(${x - 13}px, ${y - 13}px)`;
    }, { x, y });
    await page.mouse.move(x, y, { steps: 16 });
    await delay(500);
    await target.click();
    await delay(650);
    await page.evaluate(() => { document.getElementById('pointer')!.style.opacity = '0'; });
  }
  await chapter(0); await delay(5000);
  await chapter(1);
  await app.getByLabel('Correo', { exact: true }).pressSequentially(email, { delay: 38 });
  await app.getByLabel('Contraseña', { exact: true }).fill(password);
  await delay(1200);
  await click(app.getByRole('button', { name: 'Iniciar sesión', exact: true }));
  await expect(app.getByRole('heading', { name: 'Estudiante CampusLink', exact: true })).toBeVisible();
  await delay(2500);
  await chapter(2); await delay(6500);
  await chapter(3);
  await click(app.getByRole('link', { name: /Mis actividades/ }));
  await expect(app.getByText('Taller de programación colaborativa', { exact: true })).toBeVisible();
  await delay(6500);
  await click(app.getByRole('button', { name: 'Cerrar consulta personal' }));
  await chapter(4);
  await click(app.getByRole('tab', { name: 'Mercado', exact: true }));
  await expect(app.getByText('Calculadora científica', { exact: true })).toBeVisible();
  await delay(3000);
  await click(app.getByRole('radio', { name: 'Modalidad: Donación', exact: true }));
  await expect(app.getByText('Kit de dibujo técnico', { exact: true })).toBeVisible();
  await expect(app.getByText('Calculadora científica', { exact: true })).toHaveCount(0);
  await delay(2500);
  await click(app.getByRole('radio', { name: 'Modalidad: Todo', exact: true }));
  await click(app.getByText('Calculadora científica', { exact: true }));
  await expect(app.getByRole('heading', { name: 'Descripción', exact: true })).toBeVisible();
  await delay(4000);
  await click(app.getByRole('button', { name: 'Volver', exact: true }));
  await chapter(5);
  await click(app.getByRole('tab', { name: 'Biblioteca', exact: true }));
  await expect(app.getByText('Guía de programación TypeScript', { exact: true })).toBeVisible();
  await delay(3000);
  await page.screenshot({ path: screenshot });
  await app.getByPlaceholder('Buscar apuntes, guías, resúmenes…').pressSequentially('TypeScript', { delay: 130 });
  await expect(app.getByText('Apuntes de bases de datos', { exact: true })).toHaveCount(0);
  await delay(2000);
  await click(app.getByText('Guía de programación TypeScript', { exact: true }));
  await expect(app.getByText(/Tipos, funciones y trabajo colaborativo/)).toBeVisible();
  await delay(5500);
  await click(app.getByRole('button', { name: 'Volver', exact: true }));
  await click(app.getByRole('tab', { name: 'Perfil', exact: true }));
  await chapter(6); await delay(6000);
  return { timeline, durationSeconds: (Date.now() - started) / 1000 };
}
