import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

const game = read('src/ThreeGame.ts');
const types = read('src/core/types.ts');
const modes = read('src/core/GameMode.ts');
const services = read('src/core/GameDomainServices.ts');
const economy = read('src/systems/EconomySystem.ts');
const population = read('src/systems/PopulationSystem.ts');
const urban = read('src/world/UrbanCityTemplate.ts');
const twin = read('src/world/TwinFortressesTemplate.ts');
const faGame = read('src/i18n/faGame.ts');
const faRuntime = read('src/i18n/faRuntime.ts');

assert.doesNotMatch(types, /\| 'appleOrchard'/, 'Apple Orchard must not remain a TileKind.');
assert.doesNotMatch(types, /\bapples:\s*number/, 'Apple-specific economy resource must be removed.');
assert.doesNotMatch(modes, /appleOrchard/, 'Apple Orchard must not remain buildable.');
assert.doesNotMatch(services, /OrchardSystem|orchardSystem/, 'Orchard rendering service must be removed.');
assert.doesNotMatch(economy, /appleOrchard|applesPerSecond|resources\.apples/,
  'Economy must not simulate orchard/apple production.');
assert.doesNotMatch(population, /appleOrchard/, 'Population jobs must not target removed orchards.');
assert.doesNotMatch(urban, /appleOrchard/);
assert.doesNotMatch(twin, /appleOrchard/);
assert.doesNotMatch(faGame, /Apple Orchard|باغ سیب|Apples 0/);
assert.doesNotMatch(faRuntime, /Apple Orchard|باغ سیب/);

const activeGameSource = game.replace(
  /if \(kind === 'appleOrchard'\) return \{ kind: 'farm',[^\n]+\n/,
  '',
);
assert.doesNotMatch(activeGameSource, /appleOrchard|Apple Orchard|Orchards/,
  'Only legacy save migration may mention the removed orchard kind.');
assert.match(
  game,
  /if \(kind === 'appleOrchard'\) return \{ kind: 'farm', level: Math\.max\(1, Math\.min\(AGRICULTURE_MAX_LEVEL, level\)\) \};/,
  'Old orchard cells must migrate safely to farms.',
);
assert.match(
  economy,
  /legacyApples[\s\S]*food: finiteNonNegative\(source\.food, DEFAULT_RESOURCES\.food\) \+ legacyApples/,
  'Old saved apple inventory must migrate into general food.',
);

console.log('Apple Orchard removal and legacy-save migration contract passed.');
