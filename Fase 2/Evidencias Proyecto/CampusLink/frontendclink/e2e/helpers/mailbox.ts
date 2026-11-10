import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as wait } from 'node:timers/promises';

/** IMAP automatizado o puente de archivo para un conector de correo autorizado. Nunca imprime OTP. */
export async function mailboxRequest(email: string, purpose: 'registration' | 'recovery') {
  const root = dirname(process.env.E2E_QA_WRITE_RUN!), since = new Date().toISOString();
  const requestFile = resolve(root, 'mail-' + purpose + '-request.json'), codeFile = resolve(root, 'mail-' + purpose + '-code.json');
  await writeFile(requestFile, JSON.stringify({ email, purpose, since }), { mode: 0o600 });
  return async () => {
    if (process.env.QA_MAILBOX_MODE === 'imap') {
      try { await promisify(execFile)(process.env.QA_NODE_BINARY ?? process.execPath, ['qa/mailbox.mjs', requestFile, codeFile], { cwd: resolve('../backendclink'), windowsHide: true, timeout: 150_000 }); }
      catch { throw new Error('No llegó un OTP verificable por IMAP; revisar la configuración local del buzón QA'); }
    }
    const end = Date.now() + 125_000;
    while (Date.now() < end) {
      try {
        const code = JSON.parse(await readFile(codeFile, 'utf8'));
        if (code.email === email && code.purpose === purpose && code.since === since && /^\d{6,10}$/.test(code.code)) return code.code as string;
      } catch { /* El adaptador todavía no recibió el mensaje. */ }
      await wait(500);
    }
    throw new Error('No se recibió un OTP nuevo en el buzón autorizado; no se declara entrega exitosa');
  };
}
