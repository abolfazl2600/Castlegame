import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [game, gameMode, maritime, economy, saveSystem, constants, css, readme] = await Promise.all([
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/GameMode.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/systems/MaritimeSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/systems/EconomySystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/SaveSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/constants.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/style.css', import.meta.url), 'utf8'),
  readFile(new URL('../README.md', import.meta.url), 'utf8'),
]);

for (const levelName of ['Landing Dock', 'Fishing Wharf', 'Merchant Pier', 'Grand Harbor']) {
  assert.ok(game.includes(`name: '${levelName}'`), `Missing Harbor level: ${levelName}`);
}
assert.match(game, /const HARBOR_MAX_LEVEL = HARBOR_LEVELS\.length/);
assert.match(game, /const HARBOR_KINDS: HarborKind\[\] = \['harbor'\]/);

// Only one Harbor entry is selectable by current game modes and Build UI.
assert.doesNotMatch(gameMode, /'smallDock'/);
assert.doesNotMatch(gameMode, /'woodenPier'/);
assert.doesNotMatch(gameMode, /'fishingDock'/);
assert.match(gameMode, /'road','dirtRoad','stoneRoad','harbor'/);
assert.doesNotMatch(game, /id: 'smallDock'/);
assert.doesNotMatch(game, /id: 'woodenPier'/);
assert.doesNotMatch(game, /id: 'fishingDock'/);
assert.match(game, /id: 'harbor'[\s\S]*?label: 'Harbor'[\s\S]*?Upgradeable coastal port · 4 visual levels/);

// New placement and all current templates use one Harbor kind plus a level.
assert.match(game, /setCell\(gx, gy, 'harbor', 1/);
assert.match(game, /defaultShipForLevel\(1\)/);
assert.doesNotMatch(game, /placeHarborTemplate\('(smallDock|woodenPier|fishingDock|harbor)'/);
assert.match(game, /placeHarborTemplate\(1, 'fishingBoat'/);
assert.match(game, /placeHarborTemplate\(2, 'fishingBoat'/);
assert.match(game, /placeHarborTemplate\(3, 'transportShip'/);
assert.match(game, /placeHarborTemplate\(4, '(tradingBoat|transportShip)'/);

// Placement remains coastline-based and river tiles remain excluded by coastDirection.
assert.match(maritime, /if \(kind !== 'harbor'\) return null/);
assert.match(maritime, /return this\.coastDirection\(x, y\)/);
assert.match(maritime, /water !== 'water'/);
assert.match(maritime, /defaultShipForLevel\(level: number\)/);

// Level visuals must change structure, not only scale.
assert.match(game, /Level 2: fishing wharf gains side platforms, equipment, net mast and storage/);
assert.match(game, /Level 3: a real merchant pier adds a warehouse, stone apron and cargo crane/);
assert.match(game, /Level 4: grand harbor uses a wide stone quay, twin docking arms/);
assert.match(game, /warehouseRoof/);
assert.match(game, /secondCraneX/);
assert.match(game, /harbor-lantern/);
assert.match(game, /group\.userData\.harborLevel = normalizedLevel/);

// Upgrade UI follows the same selected-building pattern as Army Camp / Agriculture.
assert.match(game, /id="harbor-upgrade-card"/);
assert.match(game, /data-harbor-level="1"/);
assert.match(game, /data-harbor-level="4"/);
assert.match(game, /private syncHarborUpgradeUI\(\): void/);
assert.match(game, /private upgradeSelectedHarbor\(\): void/);
assert.match(game, /get<HTMLButtonElement>\('harbor-upgrade-button'\)\.onclick = \(\) => this\.upgradeSelectedHarbor\(\)/);
assert.match(game, /shipKind: this\.maritimeSystem\.defaultShipForLevel\(nextLevel\)/);
assert.match(css, /\.harbor-upgrade-card/);
assert.match(css, /\.harbor-level-track/);
assert.match(css, /\.harbor-upgrade-button/);

// Version-aware migration safely maps the four previous models into the progression.
assert.match(constants, /SAVE_VERSION = 13/);
assert.match(saveSystem, /migrateKind\(kind: string, level: number, saveVersion: number\)/);
assert.match(saveSystem, /this\.host\.migrateKind\(cell\.kind, cell\.level \?\? 1, Math\.max\(0, Math\.floor\(data\.version \?\? 0\)\)\)/);
assert.match(game, /if \(saveVersion < 13\)/);
assert.match(game, /kind === 'smallDock'\) return \{ kind: 'harbor', level: 1 \}/);
assert.match(game, /kind === 'fishingDock'\) return \{ kind: 'harbor', level: 2 \}/);
assert.match(game, /kind === 'woodenPier'\) return \{ kind: 'harbor', level: 3 \}/);
assert.match(game, /kind === 'harbor'\) return \{ kind: 'harbor', level: 4 \}/);
assert.match(game, /if \(kind === 'harbor'\) return \{ kind: 'harbor', level: Math\.max\(1, Math\.min\(HARBOR_MAX_LEVEL, level\)\) \}/);

// Construction economy exposes only the current Harbor line.
assert.match(economy, /harbor: \{ wood: 6 \}/);
assert.doesNotMatch(economy, /smallDock:/);
assert.doesNotMatch(economy, /woodenPier:/);
assert.doesNotMatch(economy, /fishingDock:/);

assert.match(readme, /one clear \*\*Harbor\*\* building instead of four parallel dock variants/);
assert.match(readme, /Small Dock → Level 1/);

console.log('Unified four-level Harbor progression, visuals, placement, migration, templates, and Build UX checks passed.');
