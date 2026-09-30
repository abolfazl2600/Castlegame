import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const battle = await readFile(new URL('../src/battle/BattleSystem.ts', import.meta.url), 'utf8');
const game = await readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const navigation = await readFile(new URL('../src/battle/BattleNavigation.ts', import.meta.url), 'utf8');

assert.ok(
  battle.includes('prepareDefenders(setup: BattleSetup, militaryTier: MilitaryTier = 1, force = false): void'),
  'BattleSystem must expose an idle defender preparation path',
);
assert.ok(
  battle.includes("this.mode !== 'idle'"),
  'Prepared defenders must only be rebuilt outside an active battle',
);
assert.ok(
  battle.includes('this.preparedDefenderSignature === preparedSignature'),
  'Battle start must identify and reuse the already-visible garrison',
);
assert.ok(
  battle.includes('if (!reusePreparedGarrison) this.spawnDefenders(normalized);'),
  'Battle start must not respawn defenders when the prepared garrison is reusable',
);
assert.ok(
  battle.includes("this.mode === 'idle' && this.preparedDefenderSignature"),
  'Idle defender visuals must remain animated while no attack is active',
);
assert.ok(
  battle.includes('private defenderTopologySignature(): string') &&
    battle.includes('this.defenderTopologySignature()'),
  'Standing defenders must only rebuild when defensive architecture/configuration changes',
);

assert.ok(
  navigation.includes('this.heuristic(b, objective) - this.heuristic(a, objective)'),
  'Attacker edge candidates must be ordered farthest from the castle objective',
);
assert.ok(
  battle.includes('position.addScaledVector(outward, this.world.tileSize * 2.25)'),
  'Attackers must enter from outside the map boundary instead of appearing on the playable edge',
);
assert.ok(
  battle.includes('runtime.entryTarget = edgePosition'),
  'Attackers must retain an explicit map-entry target',
);
assert.ok(
  battle.includes('if (runtime.entryTarget)'),
  'Attackers must complete their arrival movement before normal combat AI',
);
assert.ok(
  battle.includes('runtime.data.targetId = undefined;') &&
    battle.includes("runtime.data.state = 'forming';"),
  'Entering attackers must remain in forming state and ignore targets until on-map',
);

assert.ok(
  game.includes('private syncIdleDefenderGarrison(force = false): void'),
  'ThreeGame must own a reusable idle-garrison synchronization boundary',
);
assert.ok(
  game.includes('battleSystem.prepareDefenders(this.battleSetup, this.militaryTier, force)'),
  'Garrison synchronization must use configured defender composition and military tier',
);
assert.ok(
  game.includes('this.syncIdleDefenderGarrison();'),
  'Ordinary redraws must preserve an unchanged standing garrison without visible respawn flicker',
);
assert.ok(
  game.includes("if (String(field).startsWith('defender')) return;"),
  'Defenders must not be editable in Battle Setup',
);
assert.ok(
  game.includes('this.battleLayer.visible = !planMode;'),
  'Persistent 3D defenders must stay out of the top-down planning layer',
);
const resetBattle = game.slice(
  game.indexOf('private resetBattleFromUI(): void {'),
  game.indexOf('private commitPopulationBattleOutcome('),
);
assert.match(
  resetBattle,
  /this\.battleSystem\.reset\(\);[\s\S]*?this\.syncIdleDefenderGarrison\(true\);/,
  'Reset Battle must restore guards after synchronizing the camp-based roster',
);

console.log('Persistent defender garrison and off-map attacker entry regression checks passed.');
