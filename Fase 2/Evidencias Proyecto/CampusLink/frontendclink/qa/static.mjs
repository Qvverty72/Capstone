// Serve the actual exported application with the exact Blueprint headers, only on loopback.
import { createServer, request as proxyRequest } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { load } from 'js-yaml';
const root = resolve('dist');
const blueprint = load(await readFile(resolve('../../../../render.yaml'), 'utf8'));
const site = blueprint.services.find(service => service.name === 'campuslink-web-qa');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    // Keep the production CSP unchanged: local browser requests use 'self', with a fixed loopback upstream.
    if (pathname.startsWith('/api/v1/')) {
      const upstream = proxyRequest({ hostname: '127.0.0.1', port: 3011, path: request.url, method: request.method,
        headers: { ...request.headers, host: '127.0.0.1:3011' }, timeout: 30000 }, incoming => {
        response.writeHead(incoming.statusCode ?? 502, incoming.headers); incoming.pipe(response);
      });
      upstream.on('timeout', () => upstream.destroy()); upstream.on('error', () => { if (!response.headersSent) response.writeHead(503); response.end(); });
      request.pipe(upstream); return;
    }
    let file = resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    try { if (!(await stat(file)).isFile()) file = resolve(root, 'index.html'); } catch { file = resolve(root, 'index.html'); }
    for (const header of site.headers) response.setHeader(header.name, header.value);
    response.setHeader('X-Content-Type-Options', 'nosniff'); response.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
    response.end(await readFile(file));
  } catch { response.writeHead(500).end(); }
});
server.listen(Number(process.env.QA_STATIC_PORT ?? 8090), 'localhost');
const stop = () => server.close(() => process.exit(0));
process.once('SIGINT', stop); process.once('SIGTERM', stop); process.on('message', message => { if (message === 'stop') stop(); });
