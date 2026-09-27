import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const threeGame = await readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');

for (const name of ['Field Camp', 'Reinforced Camp', 'Command Camp', 'Royal War Camp']) {
  assert.ok(threeGame.includes(`name: '${name}'`), `Army Camp level missing: ${name}`);
}

assert.ok(threeGame.includes('const ARMY_CAMP_MAX_LEVEL = ARMY_CAMP_LEVELS.length'));
assert.ok(threeGame.includes("cell.kind === 'armyCamp') this.makeArmyCamp(group, Math.max(1, Math.min(ARMY_CAMP_MAX_LEVEL"));
assert.ok(threeGame.includes("if (kind === 'armyCamp') return { kind: 'armyCamp', level: Math.max(1, Math.min(ARMY_CAMP_MAX_LEVEL, level)) }"));
assert.ok(threeGame.includes('private upgradeSelectedArmyCamp(): void'));
assert.ok(threeGame.includes('this.services.state.setLevel(this.selectedCell.x, this.selectedCell.y, nextLevel)'));
assert.ok(threeGame.includes('if (nextLevel > this.militaryTier)'));
assert.ok(threeGame.includes("type CampVariant = 'field' | 'reinforced' | 'command' | 'fortified'"));
assert.ok(threeGame.includes('stone foundation, timber command hall'));
assert.ok(!threeGame.includes('cycleSelectedArmyCampVariant'));
assert.ok(!threeGame.includes("if (event.shiftKey && key === 'a')"));

assert.ok(threeGame.includes('army-camp-upgrade-card'));
assert.ok(threeGame.includes("get<HTMLButtonElement>('army-camp-upgrade-button').onclick = () => this.upgradeSelectedArmyCamp()"));
assert.ok(html.includes('four levels'));
assert.ok(html.includes('Build Settings'));
assert.ok(css.includes('.army-camp-upgrade-card'));
assert.ok(css.includes('.army-camp-level-track'));

console.log('Army Camp upgrades are sequential, four-level, Build-panel driven, and visually distinct.');
