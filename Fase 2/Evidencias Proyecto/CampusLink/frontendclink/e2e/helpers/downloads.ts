import { expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

export async function downloadFile(page: Page, button: string | RegExp, format: 'pdf' | 'xlsx') {
  const network = page.waitForResponse(response => response.request().method() === 'GET'
    && new URL(response.url()).pathname.match(new RegExp(`/export/${format}$|/files/[^/]+/download$`)) !== null,
  { timeout: 60_000 }).then(response => { expect(response.status(), 'Respuesta de descarga real').toBe(200); return response; });
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), network,
    page.getByRole('button', { name: button, exact: typeof button === 'string' }).click()]);
  expect(await download.failure()).toBeNull();
  const bytes = await readFile((await download.path())!);
  expect(bytes.length).toBeGreaterThan(500);
  if (format === 'pdf') {
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.subarray(-100).toString()).toContain('%%EOF');
  } else {
    expect(bytes.readUInt32LE(0)).toBe(0x04034b50);
    expect(bytes.includes(Buffer.from('[Content_Types].xml'))).toBe(true);
    expect(bytes.includes(Buffer.from('xl/workbook.xml'))).toBe(true);
  }
  return { bytes, name: download.suggestedFilename() };
}
