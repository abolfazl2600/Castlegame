import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const catalog = JSON.parse(read('honor-badges/catalog.v1.json'));
assert.equal(catalog.schemaVersion, 1);
assert.ok(Array.isArray(catalog.badges) && catalog.badges.length <= 100);
const ids = new Set();
for (const badge of catalog.badges) {
  assert.match(badge.id, /^[a-z][a-z0-9-]{1,47}$/);
  assert.ok(!ids.has(badge.id), 'Duplicate badge ID: ' + badge.id);
  ids.add(badge.id);
  assert.match(badge.assetPath, /^assets\/[a-z0-9][a-z0-9/_-]*\.(png|webp)$/);
  assert.ok(badge.mimeType === 'image/png' || badge.mimeType === 'image/webp');
  assert.ok(badge.assetPath.endsWith(badge.mimeType === 'image/png' ? '.png' : '.webp'));
  for (const field of ['name', 'description']) {
    for (const locale of ['fa', 'en']) {
      assert.ok(typeof badge[field]?.[locale] === 'string' &&
        badge[field][locale].trim().length > 0 && badge[field][locale].length <= 100);
    }
  }
  assert.match(badge.sha256, /^[0-9a-f]{64}$/);
  const filename = resolve(process.cwd(), 'honor-badges', badge.assetPath);
  assert.ok(existsSync(filename), 'Missing GitHub artwork file: ' + badge.assetPath);
  const image = readFileSync(filename);
  assert.ok(image.length > 12 && image.length <= 2 * 1024 * 1024);
  const isPng = image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isWebp = image.toString('ascii', 0, 4) === 'RIFF' &&
    image.toString('ascii', 8, 12) === 'WEBP';
  assert.ok(badge.mimeType === 'image/png' ? isPng : isWebp, 'Incorrect image signature');
  const hash = createHash('sha256').update(image).digest('hex');
  assert.equal(hash, badge.sha256, 'Catalog checksum mismatch for ' + badge.id);
}

assert.ok(existsSync('honor-badges/assets/.gitkeep'));
for (const bundled of [
  'public/honor-badges', 'src/assets/honor-badges',
  'android/app/src/main/assets/public/honor-badges',
  'dist/honor-badges',
]) {
  assert.equal(existsSync(bundled), false, 'Honor artwork must not ship in build: ' + bundled);
}
const service = read('src/honors/HonorBadgeRepository.ts');
assert.match(service, /https:\/\/raw\.githubusercontent\.com\/abolfazl2600\/Castlegame\/main\/honor-badges\//);
assert.match(service, /indexedDB\.open\(HONOR_BADGE_DATABASE, 1\)/);
assert.match(service, /crypto\.subtle\.digest\('SHA-256'/);
assert.match(service, /cache: 'no-store'/);
assert.doesNotMatch(service, /import\.meta\.glob/);
console.log('Honor badge phase-one manifest, offline storage and no-bundled-art contracts passed.');
