import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { appendFile, open, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip, createGunzip } from 'node:zlib';

const magic = Buffer.from('CLBK01');
export async function encrypt(source, path, key) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  const output = createWriteStream(path, { flags: 'wx', mode: 0o600 });
  output.write(Buffer.concat([magic, iv]));
  await pipeline(source instanceof Buffer ? Readable.from([source]) : source, createGzip(), cipher, output);
  await appendFile(path, cipher.getAuthTag());
}
export async function decrypt(path, key) {
  const size = (await stat(path)).size, handle = await open(path, 'r');
  const header = Buffer.alloc(18), tag = Buffer.alloc(16);
  try { await handle.read(header, 0, 18, 0); await handle.read(tag, 0, 16, size - 16); }
  finally { await handle.close(); }
  if (size < 35 || !header.subarray(0, 6).equals(magic)) throw Error('Invalid backup format');
  const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(6)); decipher.setAuthTag(tag);
  // Authenticate the entire archive before its contents are used for restoration.
  const chunks = [];
  await pipeline(createReadStream(path, { start: 18, end: size - 17 }), decipher, createGunzip(),
    async source => { for await (const chunk of source) chunks.push(chunk); });
  return Buffer.concat(chunks);
}
