import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
}
const routes = walk('app').filter(file => file.endsWith('.tsx') && !file.endsWith('_layout.tsx')).map(file => {
  const route = '/' + relative('app', file).replaceAll('\\', '/').split('/').filter(p => !p.startsWith('(')).join('/')
    .replace(/\.tsx$/, '').replace(/(^|\/)index$/, '');
  const source = readFileSync(file, 'utf8');
  return { route, file: file.replaceAll('\\', '/'), screen: /export\s*\{[^}]*default[^}]*\}\s*from ['"](@[^'"]+)['"]/.exec(source)?.[1] ?? 'inline: ' + file.replaceAll('\\', '/') };
}).sort((a, b) => a.route.localeCompare(b.route));
mkdirSync('../docs/qa', { recursive: true });
writeFileSync('../docs/qa/routes.json', JSON.stringify({
  routes,
  existingFrontendTests: walk('tests').filter(f => f.endsWith('.test.mjs')).length,
  existingFrontendQAScripts: walk('tests').filter(f => f.endsWith('.qa.mjs')).length,
  existingBackendTests: walk('../backendclink/tests').filter(f => f.endsWith('.test.ts')).length,
}, null, 2) + '\n');
console.log(`Discovered ${routes.length} Expo routes; docs/qa/routes.json updated.`);
