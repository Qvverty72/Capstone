/** Exporta Expo y el portal web independiente al mismo sitio, sin modificar rutas móviles. */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const portal = resolve(frontend, '../product-analytics-web');
const npm = process.env.npm_execpath;
if (!npm || !existsSync(npm)) throw new Error('Ejecuta este comando mediante npm run build:web.');
function run(args, cwd) {
  const result = spawnSync(process.execPath, [npm, ...args], { cwd, env: process.env, stdio: 'inherit', windowsHide: true });
  if (result.error || result.status !== 0) throw new Error('La compilación web no pudo completarse. Revisa el comando anterior.');
}
run(['run', 'poi:images'], frontend);
run(['exec', '--', 'expo', 'export', '--platform', 'web'], frontend);
run(['ci', '--ignore-scripts', '--no-audit', '--no-fund'], portal);
run(['run', 'build', '--', `--outdir=${resolve(frontend, 'dist')}`], portal);
if (!existsSync(resolve(frontend, 'dist/index.html')) || !existsSync(resolve(frontend, 'dist/analitica-producto/index.html'))) throw new Error('Falta una de las entradas web compiladas.');
console.log('CampusLink y /analitica-producto/ compilados en frontendclink/dist.');
