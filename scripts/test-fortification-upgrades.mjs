import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const threeGame = await readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const types = await readFile(new URL('../src/core/types.ts', import.meta.url), 'utf8');
const saveSystem = await readFile(new URL('../src/core/SaveSystem.ts', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');

assert.match(
  threeGame,
  /type FortificationUpgradeKind = 'tower' \| 'gate' \| 'towerBridge'/,
  'Tower, Gate, and Tower Bridge must share the fortification upgrade contract.',
);
assert.match(
  threeGame,
  /const FORTIFICATION_MAX_LEVEL = 4/,
  'Fortification progression must stop at Level 4.',
);

for (const label of ['Watch Tower', 'Royal Bastion', 'Castle Gate', 'Royal Gatehouse', 'Tower Walk', 'Royal Tower Bridge']) {
  assert.ok(threeGame.includes(label), `Missing fortification progression label: ${label}`);
}

assert.match(
  types,
  /export interface TowerBridgeState[\s\S]*?level\?: number;/,
  'Tower Bridge level must persist in TowerBridgeState while remaining backward compatible.',
);
assert.match(
  saveSystem,
  /level: clamp\(Math\.floor\(Number\(bridge\.level \?\? 1\)\), 1, 4\)/,
  'Legacy Tower Bridges must load as Level 1 and saved bridge levels must be clamped to 1-4.',
);

assert.match(
  threeGame,
  /private makeTower[\s\S]*?Math\.min\(FORTIFICATION_MAX_LEVEL, Math\.floor\(cell\.level \?\? 1\)\)/,
  'Modular Tower rendering must clamp visual progression to four levels.',
);
assert.match(
  threeGame,
  /if \(level >= 3\)[\s\S]*?gallery[\s\S]*?if \(level >= 4\)[\s\S]*?pennant/,
  'Higher Tower levels must add clearly richer defensive silhouettes.',
);

assert.match(
  threeGame,
  /private makeGate[\s\S]*?const safeLevel = Math\.max\(1, Math\.min\(FORTIFICATION_MAX_LEVEL/,
  'Gate rendering must consume the shared four-level progression.',
);
assert.match(
  threeGame,
  /const levelRise = \(safeLevel - 1\) \* 0\.55/,
  'Gate upgrades must visibly increase gatehouse scale.',
);
assert.match(
  threeGame,
  /if \(safeLevel >= 2\)[\s\S]*?if \(safeLevel >= 3\)[\s\S]*?if \(safeLevel >= 4\)/,
  'Gate levels 2-4 must add progressive visual structures.',
);

assert.match(
  threeGame,
  /private makeTowerBridge[\s\S]*?const level = Math\.max\(1, Math\.min\(FORTIFICATION_MAX_LEVEL, Math\.floor\(bridge\.level \?\? 1\)\)\)/,
  'Tower Bridge rendering must use its persisted four-level state.',
);
assert.match(
  threeGame,
  /if \(level >= 2\)[\s\S]*?tieCount[\s\S]*?if \(level >= 3\)[\s\S]*?guardCount[\s\S]*?if \(level >= 4\)/,
  'Tower Bridge upgrades must add reinforcement, guard framing, and Level 4 landmark details.',
);
assert.match(
  threeGame,
  /Tower Bridge selected · Level/,
  'Selecting an existing Tower Bridge must expose it for upgrade instead of immediately removing it.',
);
assert.match(
  threeGame,
  /private removeSelectedTowerBridge\(\): void/,
  'Tower Bridge removal must remain available as an explicit action.',
);

assert.match(
  threeGame,
  /id="fortification-upgrade-card"/,
  'Build Settings must expose the fortification upgrade card.',
);
assert.match(
  threeGame,
  /private upgradeSelectedFortification\(\): void/,
  'Build Settings must provide a shared fortification upgrade action.',
);
assert.match(
  styles,
  /\.fortification-upgrade-card[\s\S]*?\.fortification-level-track/,
  'Fortification progression UI must follow the existing upgrade-card design language.',
);

console.log('Four-level Modular Tower, Gate, and Tower Bridge upgrade checks passed.');
