import { context } from 'esbuild';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { outputRoot, options, prepare, connectOrigins } from './build.mjs';

const production = process.argv.includes('--production');
const portArg = process.argv.find(arg => arg.startsWith('--port='));
const port = Number(portArg?.slice(7) ?? 4318);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('El puerto local no es válido.');
let builder;
if (!production) {
  await prepare();
  builder = await context({ ...options, minify: false, define: { ...options.define, 'process.env.NODE_ENV': '"development"' } });
  await builder.rebuild();
  await builder.watch();
}
let origins = connectOrigins();
if (production) {
  try {
    const built = JSON.parse(await readFile(resolve(outputRoot, 'analitica-producto/connect-origins.json'), 'utf8'));
    if (Array.isArray(built) && built.every(value => typeof value === 'string' && new URL(value).origin === value && /^https?:/.test(value))) origins = built;
  } catch { /* Un build sin configuración conserva connect-src none. */ }
}
const base = resolve(outputRoot), connect = origins.length ? origins.join(' ') : "'none'";
const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405).end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/' || pathname === '/analitica-producto') { response.writeHead(302, { Location: '/analitica-producto/' }).end(); return; }
    const path = resolve(base, '.' + pathname, ...(pathname.endsWith('/') ? ['index.html'] : []));
    if (!path.startsWith(base + sep)) { response.writeHead(403).end(); return; }
    const bytes = await readFile(path);
    response.writeHead(200, {
      'Content-Type': path.endsWith('.js') ? 'text/javascript; charset=utf-8' : path.endsWith('.css') ? 'text/css; charset=utf-8' : path.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8',
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src ${connect}; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`,
    });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch { response.writeHead(404).end('Ruta de analítica no encontrada.'); }
});
server.listen(port, '127.0.0.1', () => console.log(`CampusLink · http://127.0.0.1:${port}/analitica-producto/`));
async function shutdown() { await builder?.dispose(); server.close(); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
