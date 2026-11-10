import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mockEnvironment } from './environment';

// Never inherit the project's private .env or silently reuse a production build.
const localRequire = createRequire(resolve('package.json'));
const child = spawn(process.execPath, [localRequire.resolve('expo/bin/cli'), 'start', '--web', '--localhost', '--port', '8088'], {
  stdio: 'inherit', env: { ...process.env, ...mockEnvironment, CI: '1' },
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 1));
