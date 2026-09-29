import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [settlementStyle, threeGame, visualScene, audit] = await Promise.all([
  readFile(new URL('../src/rendering/SettlementStyle.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
  readFile(new URL('./visual-reference-scene.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../docs/visual-audits/issue-130/README.md', import.meta.url), 'utf8'),
]);

for (const family of [
  'cottage',
  'house',
  'manor',
  'villa',
  'farm',
  'cowBarn',
  'market',
  'windmill',
  'armyCamp',
  'harbor',
  'basilica',
  'keep',
  'modernFortress',
]) {
  assert.match(
    settlementStyle,
    new RegExp(`\\b${family}: \\{ massing:`),
    `Silhouette contract must document ${family}.`,
  );
}

assert.match(
  settlementStyle,
  /cottage:[\s\S]*height:\s*1\.12[\s\S]*height:\s*1\.02[\s\S]*height:\s*1\.18/,
  'Cottage must stay a deliberately low, loose cluster.',
);
assert.match(
  settlementStyle,
  /house:[\s\S]*height:\s*1\.82/,
  'House must keep a taller central dwelling for dense-block recognition.',
);
assert.match(
  settlementStyle,
  /manor:[\s\S]*width:\s*1\.72[\s\S]*height:\s*2\.55/,
  'Manor must preserve a dominant central hall.',
);
assert.match(
  settlementStyle,
  /villa:[\s\S]*rotation:\s*Math\.PI \/ 2[\s\S]*height:\s*1\.42/,
  'Villa must retain its open U-shaped court massing.',
);
assert.match(
  threeGame,
  /RESIDENCE_LAYOUTS\[kind\]\.forEach/,
  'Residential rendering must consume the shared silhouette layouts.',
);
assert.match(
  visualScene,
  /WorldStyle\.ts/,
  'Visual reference camera must derive from the shared gameplay camera config.',
);
assert.match(
  visualScene,
  /nearInspection:[^]*normalGameplay:[^]*maximumStrategic:/,
  'Visual fixture must exercise all three named gameplay reference distances.',
);
assert.match(
  audit,
  /Normal gameplay: 104/,
  'The audit must state the authoritative normal gameplay distance.',
);
assert.match(
  audit,
  /No gameplay footprint changes were made/,
  'Silhouette audit must explicitly preserve gameplay footprints.',
);

console.log('Normal-zoom building silhouette contract checks passed.');
