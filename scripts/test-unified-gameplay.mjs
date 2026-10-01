import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';

// Run the actual TypeScript runtime, including its extensionless bundler imports.
const packageUrl = new URL('../package.json', import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    try { return next(specifier, context); }
    catch (error) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(specifier + '.ts', context);
      throw error;
    }
  },
  load(url, context, next) {
    if (url.endsWith('.ts')) return { format: 'module', shortCircuit: true,
      source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform' }) };
    if (url === packageUrl) return { format: 'module', shortCircuit: true,
      source: 'export default ' + readFileSync(new URL(url), 'utf8') };
    return next(url, context);
  },
});
const { SaveSystem } = await import('../src/core/SaveSystem.ts');
const { GameState } = await import('../src/state/GameState.ts');
const { KeepSystem } = await import('../src/building/KeepSystem.ts');
const { GAME_DEFINITION, normalizeGameMode, isToolAvailable, isBuildingAvailable } = await import('../src/core/GameMode.ts');
const { SAVE_AUTOSAVE_KEY, SAVE_LEGACY_KEY, SAVE_VERSION } = await import('../src/core/constants.ts');
const { defaultMissileState, beginMissileProduction, missilesUnlocked, tickMissileState, MISSILE_CONFIG } = await import('../src/battle/MissileCapability.ts');
const { getEndlessDefenseWave, endlessDefenseEnemyCount } = await import('../src/battle/EndlessDefense.ts');
const { EconomySystem } = await import('../src/systems/EconomySystem.ts');
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const game = read('src/ThreeGame.ts');
const html = read('index.html');
assert.doesNotMatch(html, /game-mode-modal|game-mode-button|data-game-mode|Medieval and Survival/);
assert.doesNotMatch(read('src/ui/MobileUI.ts'), /game-mode-button|game-mode-label/);
for (const file of ['src/SurvivalGameMode.ts', 'src/SandboxGameMode.ts', 'src/core/GameModeFoundation.ts', 'src/core/GameSession.ts']) {
  assert.equal(existsSync(new URL('../' + file, import.meta.url)), false);
}
assert.equal(new Set(GAME_DEFINITION.availableTools).size, GAME_DEFINITION.availableTools.length);
for (const tool of GAME_DEFINITION.availableTools) {
  assert.equal(isToolAvailable(tool), true);
  assert.ok(game.includes("id: '" + tool + "'"), `Visible tool definition missing: ${tool}`);
}
assert.ok(isBuildingAvailable('carpenter'));

// Real save loading: mode migration must never discard unrelated world/system data.
for (const mode of ['medieval', 'survival', 'sandbox']) {
  for (const legacyFormat of [false, true]) {
    const state = new GameState();
    const keepSystem = new KeepSystem();
    const values = {};
    const host = {
      state, keepSystem, terrainOverrides: new Map(), elevationOverrides: new Map(), towerBridges: new Map(),
      getGameMode: () => state.getGameMode(), getMapLayoutId: () => values.mapLayoutId ?? 'island',
      getWorldSeed: () => values.worldSeed ?? 0, getStoneStyle: () => values.stoneStyle ?? 'limestone',
      getWorldSeeded: () => true, getMilitaryTier: () => values.militaryTier ?? 1,
      getEconomyState: () => values.economy, getPopulationState: () => values.population,
      setLoadedSaveVersion: () => {}, migrateKind: (kind, level) => ({ kind, level }),
      isBuildingAvailable, key: (x, y) => `${x},${y}`, syncLoadedWorldUI: () => {}, setStatus: () => {},
    };
    for (const name of ['MapLayoutId', 'WorldSeed', 'StoneStyle', 'WorldSeeded', 'MilitaryTier', 'EconomyState', 'PopulationState']) {
      const key = name.endsWith('State') ? name.slice(0, -5) : name;
      host['set' + name] = value => { values[key[0].toLowerCase() + key.slice(1)] = value; };
    }
    const data = { version: SAVE_VERSION, updatedAt: Date.now(), gameMode: mode, worldSeeded: true,
      mapLayoutId: 'peninsula', worldSeed: 42, stoneStyle: 'limestone', militaryTier: 4,
      cells: [{ x: 5, y: 5, kind: 'carpenter', level: 2 }, { x: 6, y: 5, kind: 'wall1', level: 2, damage: 0.25 }],
      keeps: [{ id: 1, x: 9, y: 9, width: 3, depth: 3, floors: 2, rotation: 0, cornerTowers: true, roof: 'sloped', battlements: true }],
      towerBridges: [{ id: 1, ax: 1, ay: 1, bx: 3, by: 1, kind: 'wood', level: 2 }],
      terrain: [{ x: 2, y: 2, kind: 'river' }], elevations: [{ x: 3, y: 3, value: 2.5 }],
      missiles: { ...defaultMissileState(), stock: 2, cooldownRemainingMs: 6000 },
      economy: { logs: 10, wood: 77, stone: 45, grain: 20, apples: 8, flour: 3, food: 12 },
      population: { nextCitizenId: 12, nextSoldierId: 3, housingCapacityHighWater: 40, citizens: [],
        professionalArmy: [{ id: 'soldier-1', alive: true, unitType: 'archer', camp: { x: 8, y: 8 } }] },
    };
    const record = { metadata: { id: 'test', slot: 'autosave', name: 'test', createdAt: data.updatedAt,
      updatedAt: data.updatedAt, schemaVersion: SAVE_VERSION, gameMode: mode,
      summary: { buildings: 2, keeps: 1, terrainChanges: 1, elevations: 1 } }, data };
    const memory = new Map([[legacyFormat ? SAVE_LEGACY_KEY : SAVE_AUTOSAVE_KEY, JSON.stringify(legacyFormat ? data : record)]]);
    const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
    const saves = new SaveSystem(host, storage);
    assert.equal(saves.load(), true, `${mode}: ${legacyFormat ? 'legacy' : 'record'} save loads`);
    assert.equal(state.getGameMode(), 'unified');
    assert.equal(normalizeGameMode(mode), 'unified');
    assert.equal(state.entries().length, 2);
    assert.equal(state.getCell(5, 5).kind, 'carpenter');
    assert.equal(state.getCell(6, 5).damage, 0.25);
    assert.deepEqual(keepSystem.entries(), data.keeps);
    assert.deepEqual([...host.terrainOverrides], [['2,2', 'river']]);
    assert.deepEqual([...host.elevationOverrides], [['3,3', 2.5]]);
    assert.deepEqual(host.towerBridges.get(1), data.towerBridges[0]);
    assert.deepEqual(state.getMissileState(), data.missiles);
    assert.deepEqual(values.economy, data.economy);
    assert.deepEqual(values.population, data.population);
    assert.equal(values.mapLayoutId, 'peninsula');
    assert.equal(values.worldSeed, 42);
    assert.equal(values.militaryTier, 4);
    assert.equal(saves.autoSave(false), true);
    const saved = JSON.parse(memory.get(SAVE_AUTOSAVE_KEY));
    assert.equal(saved.metadata.gameMode, 'unified');
    assert.equal(saved.data.gameMode, 'unified');
  }
}

assert.equal(missilesUnlocked(3), false);
assert.equal(missilesUnlocked(4), true);
assert.equal(beginMissileProduction(defaultMissileState(), 3, false).ok, false);
assert.equal(beginMissileProduction(defaultMissileState(), 4, true).ok, false);
const production = beginMissileProduction(defaultMissileState(), 4, false);
assert.equal(production.ok, true);
assert.equal(production.state.supply, MISSILE_CONFIG.maxSupply - MISSILE_CONFIG.supplyCost);
assert.equal(tickMissileState(production.state, MISSILE_CONFIG.productionMs, true, true, true).state.stock, 1);

// Exercise the actual integration methods without a GPU/render loop.
const names = ['economyConstructionEnabled', 'isConstructionAffordable', 'spendConstructionCost',
  'startBattleFromUI', 'startEndlessDefenseFromUI', 'startEndlessDefenseWave', 'updateEndlessDefense', 'stopBattleFromUI', 'resetBattleFromUI'];
const methods = names.map(name => {
  const start = game.indexOf('  private ' + name + '(');
  const end = game.indexOf('\n  private ', start + 1);
  assert.ok(start >= 0 && end > start, name);
  return game.slice(start, end);
}).join('\n');
const shell = { classList: { add() {}, remove() {} } };
const Runtime = runInNewContext(stripTypeScriptTypes('class Runtime {\n' + methods + '\n}\nRuntime;', { mode: 'transform' }), {
  getEndlessDefenseWave, endlessDefenseEnemyCount, document: { getElementById: () => shell }, audioEvents: { emit() {} },
});
const runtime = new Runtime();
const economy = new EconomySystem();
Object.assign(runtime, { freeBuildEnabled: false, services: { economySystem: economy,
  state: { entries: () => [] }, populationSystem: { setMilitiaMobilized() {} }, gateSystem: { setAttackState() {} } },
  syncEconomyUI() {}, syncPopulationDefenseAssignments() {}, syncBattleSetupUI() {}, setViewMode() {}, setToolbarOpen() {},
  setStatus(message) { this.message = message; }, updateBattleUI() {}, redraw() {}, reconcileSettlementAgents() {},
  syncIdleDefenderGarrison() {}, commitPopulationBattleOutcome() {}, settingsStore: { get: () => ({ gameplay: { combatFeedback: false } }) },
  workerLayer: {}, settlementLayer: {}, militaryTier: 4, viewMode: 'world3d', battleSetup: { defenderSwordsmen: 4 },
});
const before = economy.getState();
runtime.spendConstructionCost('wall1');
assert.ok(economy.getState().stone < before.stone);
runtime.freeBuildEnabled = true;
const freeBefore = economy.getState();
runtime.spendConstructionCost('wall1', 1000);
assert.deepEqual(economy.getState(), freeBefore);
assert.equal(runtime.isConstructionAffordable('wall1', 1000), true);
runtime.freeBuildEnabled = false;
assert.equal(runtime.isConstructionAffordable('wall1', 1000), false);
const starts = [];
let status = { mode: 'idle' };
runtime.battleSystem = {
  isActive: () => status.mode !== 'idle', status: () => status,
  start(setup, options) { starts.push({ setup, options }); status = { mode: 'running' }; },
  stop() { if (status.mode === 'running') status = { mode: 'paused' }; },
  resume() { if (status.mode === 'paused') status = { mode: 'running' }; },
  reset() { status = { mode: 'idle' }; },
};
runtime.startEndlessDefenseFromUI();
assert.equal(runtime.endlessDefenseWave, 1);
assert.equal(starts[0].options.preserveSessionWallDamage, true);
runtime.stopBattleFromUI();
runtime.startBattleFromUI();
assert.equal(runtime.endlessDefenseActive, true, 'Resume must retain Endless Defense');
assert.equal(status.mode, 'running');
status = { mode: 'finished', result: { winner: 'defender' } };
runtime.updateEndlessDefense(16);
runtime.stopBattleFromUI();
runtime.updateEndlessDefense(10000);
assert.equal(starts.length, 1, 'Paused intermission must not advance');
runtime.startBattleFromUI();
runtime.updateEndlessDefense(4000);
assert.equal(starts.length, 2);
assert.equal(runtime.endlessDefenseWave, 2);
assert.ok(endlessDefenseEnemyCount(getEndlessDefenseWave(11).enemies) > endlessDefenseEnemyCount(getEndlessDefenseWave(10).enemies));
status = { mode: 'finished', result: { winner: 'attacker' } };
runtime.updateEndlessDefense(16);
assert.equal(runtime.endlessDefenseActive, false);
runtime.updateEndlessDefense(10000);
assert.equal(starts.length, 2, 'Defeat must stop future waves');
runtime.resetBattleFromUI();
assert.equal(status.mode, 'idle');
assert.equal(runtime.endlessDefenseWave, 0);

// Android Back keeps map selection open and closes normal panels via their handlers.
let back;
let visible = 'map-layout-modal';
const clicked = [];
let minimized = false;
const android = read('src/android/androidBackNavigation.ts').replace(/^import .*;\n/gm, '');
const install = runInNewContext(stripTypeScriptTypes(android.replace('export function', 'function') + '\ninstallAndroidBackNavigation;', { mode: 'transform' }), {
  App: { addListener(_event, handler) { back = handler; return Promise.resolve(); }, minimizeApp() { minimized = true; } },
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' },
  document: { getElementById(id) { return id === visible ? { hidden: false } : { hidden: true, click() { clicked.push(id); } }; },
    querySelectorAll: () => [], querySelector: () => null }, getComputedStyle: () => ({ display: 'block' }), console,
});
install();
back();
assert.equal(minimized, false);
assert.deepEqual(clicked, []);
for (const [panel, close] of [['settings-modal', 'settings-close'], ['templates-modal', 'templates-close-button'], ['god-mode-panel', 'god-mode-close'], ['battle-panel', 'battle-close']]) {
  visible = panel;
  back();
  assert.equal(clicked.at(-1), close);
}
console.log('Unified gameplay: legacy save preservation, tools, construction costs, missiles, Endless Defense lifecycle, and Android navigation passed.');
