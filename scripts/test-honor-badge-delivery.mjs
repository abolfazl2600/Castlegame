import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const catalog = JSON.parse(read('honor-badges/catalog.v1.json'));
assert.deepEqual(catalog, { schemaVersion: 1, badges: [] },
  'phase one must not add actual badges or award rules');
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
