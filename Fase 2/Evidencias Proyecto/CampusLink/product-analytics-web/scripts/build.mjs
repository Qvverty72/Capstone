import { build } from 'esbuild';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const root = fileURLToPath(new URL('../', import.meta.url));
const outArg = process.argv.find(arg => arg.startsWith('--outdir='));
export const outputRoot = resolve(root, outArg?.slice(9) ?? 'dist');
export const publicEnvironment = Object.fromEntries([
  'EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
].map(name => [name, process.env[name]?.trim() ?? '']));

// Rechaza secretos antes de incorporarlos al bundle, no solo al ejecutar el cliente.
for (const name of ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_SUPABASE_URL']) {
  if (!publicEnvironment[name]) continue;
  try {
    const url = new URL(publicEnvironment[name]);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || url.search) throw new Error();
  } catch { throw new Error('Una URL pública del portal no es válida; usa HTTP(S) sin credenciales, query ni fragmento.'); }
}
for (const name of ['EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']) {
  const key = publicEnvironment[name];
  if (!key) continue;
  if (key.startsWith('sb_publishable_')) continue;
  try { if (JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role !== 'anon') throw new Error(); }
  catch { throw new Error('El portal requiere una clave Supabase pública publishable o anon; no se permite una clave de servidor.'); }
}

export function connectOrigins() {
  return [...new Set(['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_SUPABASE_URL'].flatMap(name => {
    try { const url = new URL(publicEnvironment[name]); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash ? [url.origin] : []; }
    catch { return []; }
  }))];
}

export const options = {
  absWorkingDir: root, tsconfig: 'tsconfig.json', entryPoints: ['src/main.tsx'], bundle: true,
  outfile: resolve(outputRoot, 'analitica-producto/assets/app.js'), jsx: 'automatic',
  target: ['es2022'], minify: true, sourcemap: false,
  define: { 'process.env.NODE_ENV': '"production"',
    ...Object.fromEntries(Object.entries(publicEnvironment).map(([name, value]) => [`process.env.${name}`, JSON.stringify(value)])),
  }, logLevel: 'info',
};
export async function prepare() {
  await mkdir(resolve(outputRoot, 'analitica-producto/assets'), { recursive: true });
  await copyFile(resolve(root, 'index.html'), resolve(outputRoot, 'analitica-producto/index.html'));
  // Solo orígenes públicos: el servidor local conserva la CSP de un build separado.
  await writeFile(resolve(outputRoot, 'analitica-producto/connect-origins.json'), JSON.stringify(connectOrigins()));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await prepare();
  await build(options);
}
