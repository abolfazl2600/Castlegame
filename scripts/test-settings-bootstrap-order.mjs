import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(
  new URL('../src/main.ts', import.meta.url),
  'utf8',
);

const settingsIndex = main.indexOf('new SettingsUI(');
const mobileIndex = main.search(/new\s+MobileUI\s*\(/);
const runtimeImportIndex = main.indexOf("import('./ThreeGame')");

assert.notEqual(settingsIndex, -1, 'SettingsUI bootstrap is missing.');
assert.notEqual(mobileIndex, -1, 'MobileUI bootstrap is missing.');
assert.match(
  main,
  /new\s+MobileUI\s*\(\s*settingsStore\s*\)/,
  'MobileUI must receive the shared SettingsStore so touch/mobile preference can control layout.',
);
assert.notEqual(runtimeImportIndex, -1, 'ThreeGame must be loaded by the isolated runtime bootstrap.');

assert.ok(
  settingsIndex < runtimeImportIndex,
  'SettingsUI must initialize before the ThreeGame runtime is loaded.',
);
assert.ok(
  mobileIndex < runtimeImportIndex,
  'MobileUI must initialize before the ThreeGame runtime is loaded.',
);
assert.doesNotMatch(
  main,
  /import\s+\{\s*ThreeGame\s*\}\s+from\s+['"]\.\/ThreeGame['"]/,
  'ThreeGame must not be a static dependency of application-level Settings bootstrap.',
);
assert.match(
  main,
  /try\s*\{[\s\S]*?import\('\.\/ThreeGame'\)[\s\S]*?new ThreeGame\([\s\S]*?\}\s*catch\s*\(error\)/,
  'ThreeGame initialization must remain isolated behind a runtime error boundary.',
);

console.log('Settings bootstrap order regression checks passed.');
