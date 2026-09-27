import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const threeGame = await readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');

for (const name of ['Smallholding', 'Irrigated Farm', 'Prosperous Farmstead', 'Manorial Farm']) {
  assert.ok(threeGame.includes(`name: '${name}'`), `Farm level missing: ${name}`);
}

for (const name of ['Cattle Shed', 'Reinforced Barn', 'Expanded Stockyard', 'Royal Stockyard']) {
  assert.ok(threeGame.includes(`name: '${name}'`), `Cow Barn level missing: ${name}`);
}

assert.ok(threeGame.includes("type AgricultureUpgradeKind = 'farm' | 'cowBarn'"));
assert.ok(threeGame.includes('const AGRICULTURE_MAX_LEVEL = 4'));
assert.ok(threeGame.includes("cell.kind === 'farm') this.makeFarm(group, Math.max(1, Math.min(AGRICULTURE_MAX_LEVEL"));
assert.ok(threeGame.includes("cell.kind === 'cowBarn') this.makeCowBarn(group, Math.max(1, Math.min(AGRICULTURE_MAX_LEVEL"));
assert.ok(threeGame.includes("if (kind === 'farm' || kind === 'cowBarn')"));
assert.ok(threeGame.includes('Math.min(AGRICULTURE_MAX_LEVEL, level)'));

assert.ok(threeGame.includes('private makeFarm(group: THREE.Group, level = 1): THREE.Group'));
assert.ok(threeGame.includes('group.userData.farmLevel = normalizedLevel'));
assert.ok(threeGame.includes('Level 2: visible irrigation expansion and a covered work station.'));
assert.ok(threeGame.includes('Level 3: the small shed grows into a proper timber granary.'));
assert.ok(threeGame.includes('Level 4: a stone-backed estate storehouse and formal farm gate.'));

assert.ok(threeGame.includes('private makeCowBarn(group: THREE.Group, level: number, gx: number, gy: number): THREE.Group'));
assert.ok(threeGame.includes("this.makeHouse(group, 'cowBarn', gx, gy)"));
assert.ok(threeGame.includes('group.userData.cowBarnLevel = normalizedLevel'));
assert.ok(threeGame.includes('Level 2: expanded hay storage and a timber feeding canopy.'));
assert.ok(threeGame.includes('Level 3+: the original shed becomes a substantial stone-footed barn.'));
assert.ok(threeGame.includes('Level 1 — Cattle Shed: compact, rustic and intentionally sparse.'));
assert.ok(threeGame.includes('Level 2 — Reinforced Barn: larger timber mass, expanded yard, feeding canopy,'));
assert.ok(threeGame.includes('Level 3 — Expanded Stockyard: twin-building silhouette, stone-backed main barn,'));
assert.ok(threeGame.includes('Level 4 — Royal Stockyard: unmistakable final form with larger barn mass,'));
assert.ok(threeGame.includes("group.userData.cowBarnVisualVariant = 'cattle-shed'"));
assert.ok(threeGame.includes("group.userData.cowBarnVisualVariant = 'reinforced-barn'"));
assert.ok(threeGame.includes("group.userData.cowBarnVisualVariant = 'expanded-stockyard'"));
assert.ok(threeGame.includes("group.userData.cowBarnVisualVariant = 'royal-stockyard'"));
assert.ok(threeGame.includes('const addFenceRun = ('));
assert.ok(threeGame.includes('const addBarnBlock = ('));
assert.ok(threeGame.includes('herdSize: normalizedLevel === 1 ? 1 : normalizedLevel === 2 ? 3 : normalizedLevel === 3 ? 5 : 7'));
assert.ok(threeGame.includes('hasExpandedFence: normalizedLevel >= 2'));
assert.ok(threeGame.includes('hasSecondaryBarn: normalizedLevel >= 3'));
assert.ok(threeGame.includes('hasSiloAndFormalGate: normalizedLevel >= 4'));

assert.ok(threeGame.includes('agriculture-upgrade-card'));
assert.ok(threeGame.includes('data-agriculture-level="1"'));
assert.ok(threeGame.includes('private syncAgricultureUpgradeUI(): void'));
assert.ok(threeGame.includes('private upgradeSelectedAgricultureBuilding(): void'));
assert.ok(threeGame.includes("get<HTMLButtonElement>('agriculture-upgrade-button').onclick = () => this.upgradeSelectedAgricultureBuilding()"));
assert.ok(threeGame.includes('this.services.state.setLevel(this.selectedCell.x, this.selectedCell.y, nextLevel)'));
assert.ok(threeGame.includes('this.syncAgricultureUpgradeUI();'));

assert.ok(threeGame.includes("detail: 'Upgradeable crop farm · 4 visual levels'"));
assert.ok(threeGame.includes("detail: 'Upgradeable cattle farm · 4 visual levels'"));
assert.ok(html.includes('Farm and Cow Barn are now upgradeable agriculture buildings with four levels'));
assert.ok(css.includes('.agriculture-upgrade-card'));
assert.ok(css.includes('.agriculture-level-track'));
assert.ok(css.includes('.agriculture-upgrade-button'));

console.log('Farm and Cow Barn upgrades are sequential, save-compatible, and Cow Barn levels have strong structural visual progression.');
