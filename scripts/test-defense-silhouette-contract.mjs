import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [language, threeGame, battleSystem, keepRenderer, accessTest, audit] = await Promise.all([
  readFile(new URL('../src/rendering/DefenseVisualLanguage.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/battle/BattleSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/rendering/KeepRenderer.ts', import.meta.url), 'utf8'),
  readFile(new URL('./test-castle-access-navigation.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../docs/visual-audits/issue-133/README.md', import.meta.url), 'utf8'),
]);

for (const token of [
  "role: 'stone-curtain'",
  "role: 'timber-palisade'",
  "role: 'reinforced-bulwark'",
  "role: 'gatehouse'",
  "role: 'keep'",
  "role: 'watch-tower'",
  "role: 'corner-tower'",
]) {
  assert.ok(language.includes(token), `Missing defensive silhouette role: ${token}`);
}

assert.match(
  language,
  /wall2:[\s\S]*skyline: 'sparse-pointed-timber-posts'/,
  'Wall2 must have a timber-palisade skyline instead of reading like a recolored stone wall.',
);
assert.match(
  language,
  /wall3:[\s\S]*skyline: 'broad-shouldered-crenellated-cap'/,
  'Wall3 must have a visibly reinforced skyline.',
);
assert.match(
  language,
  /healthy:[\s\S]*damaged:[\s\S]*heavy:[\s\S]*partial:[\s\S]*breached:/,
  'All five wall damage readability stages must be documented in code.',
);

assert.match(
  threeGame,
  /group\.userData\.defenseSilhouette = WALL_SILHOUETTE_PROFILES\[kind\]/,
  'Wall render groups must expose their silhouette role.',
);
assert.match(
  threeGame,
  /private addTimberPalisadeCrown\([\s\S]*?new THREE\.ConeGeometry\(0\.2, 0\.48, 4\)/,
  'Timber walls must use a bounded pointed-post crown.',
);
assert.match(
  threeGame,
  /private addReinforcedWallCrown\([\s\S]*?thickness \+ 0\.54[\s\S]*?zFactor of \[0\.28, 0\.72\]/,
  'Reinforced walls must use a broad cap plus limited bastion-like top blocks.',
);
assert.match(
  threeGame,
  /Twin raised pier crowns make a gate readable as an entrance[\s\S]*?if \(safeLevel < 4\)/,
  'Gatehouses must keep a distinct twin-pier skyline before the Level 4 turret form.',
);
assert.match(
  threeGame,
  /group\.userData\.defenseSilhouette = \{[\s\S]*?towerSilhouetteProfile\(shape\)/,
  'Tower renderers must expose role-specific silhouette metadata.',
);
assert.match(
  threeGame,
  /if \(shape === 'watch'\)[\s\S]*?collarRadius[\s\S]*?else if \(shape === 'corner'\)[\s\S]*?shoulder/,
  'Watch and corner towers must have different large-form skyline cues.',
);

assert.match(
  keepRenderer,
  /KEEP_SILHOUETTE_PROFILE/,
  'Keep renderer must participate in the defensive silhouette language.',
);

assert.match(
  battleSystem,
  /private addWallDamageSilhouetteCue\(/,
  'Battle damage must add an explicit skyline readability cue.',
);
assert.match(
  battleSystem,
  /height - \(partial \? 1\.45 : 1\.05\)/,
  'Heavy and partial cavities must track real wall height instead of fixed world coordinates.',
);
assert.match(
  battleSystem,
  /stage === 'damaged' \? 1[\s\S]*?stage === 'heavy' \? 2[\s\S]*?3/,
  'Damage skyline cue must scale from damaged through partial breach.',
);
assert.match(
  battleSystem,
  /wall\.visual\.userData\.damageStage = wall\.stage/,
  'Damage stage must remain inspectable on the battle visual.',
);
assert.match(
  battleSystem,
  /addBrokenWallRemnants\(damageRoot, wall, height\)/,
  'Full breach must preserve the detailed broken-wall remnant system.',
);

assert.match(
  accessTest,
  /Wall-connected access removal\/navigation regression checks passed/,
  'The wall-access removal regression must remain active.',
);
assert.doesNotMatch(
  threeGame,
  /makeGeneratedAccess|makeStairTower|private makeAccess\(/,
  'Defensive readability work must not reintroduce bulky wall-connected access architecture.',
);

assert.match(audit, /Normal gameplay: 104/);
assert.match(audit, /Maximum strategic: 148/);
assert.match(audit, /does \*\*not\*\* change:/);
assert.match(audit, /Siege ladders used by attackers/);

console.log('Defensive silhouette and wall damage readability contract checks passed.');
