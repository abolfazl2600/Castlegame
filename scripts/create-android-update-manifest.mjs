import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i];
  const value = process.argv[i + 1];
  if (!key?.startsWith('--') || value === undefined) {
    throw new Error('Usage: --zip <path> --build-id <id> --url <https-url> --output <path>');
  }
  args.set(key.slice(2), value);
}

const zipPath = resolve(args.get('zip') ?? '');
const buildId = (args.get('build-id') ?? '').trim();
const url = (args.get('url') ?? '').trim();
const output = resolve(args.get('output') ?? '');

if (!buildId || !/^[A-Za-z0-9_-]{7,128}$/.test(buildId)) {
  throw new Error('Invalid Android OTA buildId.');
}
if (!url.startsWith('https://')) {
  throw new Error('Android OTA package URL must use HTTPS.');
}
if (!output) {
  throw new Error('Android OTA manifest output path is required.');
}

const archive = readFileSync(zipPath);
if (archive.length === 0) throw new Error('Android OTA ZIP is empty.');

const sha256 = createHash('sha256').update(archive).digest('hex');
const manifest = {
  version: 1,
  buildId,
  createdAt: new Date().toISOString(),
  url,
  sha256,
};

writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`Android OTA manifest generated for ${buildId} (${sha256}).`);
