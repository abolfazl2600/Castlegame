import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (error) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) {
        return next(specifier + '.ts', context);
      }
      throw error;
    }
  },
  load(url, context, next) {
    if (url.endsWith('.ts')) {
      return {
        format: 'module',
        shortCircuit: true,
        source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform' }),
      };
    }
    return next(url, context);
  },
});

const { SelectionVisual } = await import('../src/selection/SelectionVisual.ts');

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log('ok: ' + name);
};

check('selection visual renders one fill plus four lightweight edges', () => {
  const visual = new SelectionVisual(
    4,
    (x, y) => ({ x: (x + 0.5) * 4, z: (y + 0.5) * 4 }),
    () => 0,
  );
  visual.show([{ x: 2, y: 3 }]);
  assert.equal(visual.layer.children.length, 5);
  assert.equal(visual.layer.name, 'selection-visual');
  visual.clear();
  assert.equal(visual.layer.children.length, 0);
});

check('relocation previews expose distinct valid and invalid colors', () => {
  const visual = new SelectionVisual(4, (x, y) => ({ x: x * 4, z: y * 4 }), () => 1);
  visual.show([{ x: 1, y: 1 }], 'valid');
  assert.equal(visual.layer.children[0].material.color.getHex(), 0x66e889);
  visual.show([{ x: 1, y: 1 }], 'invalid');
  assert.equal(visual.layer.children[0].material.color.getHex(), 0xff7168);
});

const source = readFileSync(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const style = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

const method = (name) => {
  const start = source.indexOf('  private ' + name + '(');
  assert.ok(start >= 0, 'missing method: ' + name);
  const end = source.indexOf('\n  private ', start + 1);
  return source.slice(start, end < 0 ? source.length : end);
};

check('Inspect mode selects structures and clears empty-terrain selection', () => {
  const body = method('handleBuildClick');
  assert.match(body, /if \(this\.selectedTool === null\)/);
  assert.match(body, /else if \(cell\)/);
  assert.match(body, /this\.clearSelection\(\)/);
  assert.match(body, /this\.renderSelectionVisual\(\)/);
});

check('contextual panel owns the expected building actions', () => {
  for (const id of [
    'world-selection-panel',
    'world-selection-upgrade',
    'world-selection-move',
    'world-selection-rotate',
    'world-selection-demolish',
    'world-selection-deselect',
  ]) {
    assert.ok(source.includes(id), 'missing contextual action: ' + id);
  }
  assert.match(style, /\.world-selection-panel/);
  assert.match(style, /touch-action:\s*manipulation/);
});

check('upgrade action dispatches into existing building upgrade systems', () => {
  const body = method('upgradeSelectedBuilding');
  for (const call of [
    'upgradeSelectedFortification',
    'upgradeSelectedArmyCamp',
    'upgradeSelectedResidence',
    'upgradeSelectedMosque',
    'upgradeSelectedAgricultureBuilding',
    'upgradeSelectedCarpenter',
    'upgradeSelectedHarbor',
  ]) {
    assert.ok(body.includes('this.' + call + '()'), 'missing upgrade dispatch: ' + call);
  }
});

check('Move is explicit, validated, state preserving, and undoable', () => {
  const begin = method('beginRelocation');
  const evaluate = method('evaluateRelocationTarget');
  const commit = method('commitRelocation');
  assert.match(begin, /this\.battleSystem\.isActive\(\)/);
  assert.match(evaluate, /validateKeepDraft/);
  assert.match(evaluate, /canBuildMarketAt/);
  assert.match(evaluate, /maritimeSystem\.canPlace/);
  assert.match(evaluate, /canBuildOnTerrain/);
  assert.match(commit, /this\.recordHistory\(\)/);
  assert.match(commit, /services\.keepSystem\.update/);
  assert.match(commit, /services\.state\.setCell/);
  assert.match(commit, /this\.scheduleSave\(\)/);
});

check('Market relocation preview uses its real 3x3 placement footprint', () => {
  const body = method('evaluateRelocationTarget');
  assert.match(body, /cell\.kind === 'market'[\s\S]*buildPlacementFootprint\('market', point\)/);
});

check('camera drag cannot commit or leave a relocation preview behind', () => {
  const body = method('bindPointerInput');
  assert.match(body, /if \(movement <= 6\)/);
  assert.match(body, /else if \(this\.relocationState\)[\s\S]*this\.renderSelectionVisual\(\)/);
});

check('contextual demolition respects confirmation settings and remains undoable', () => {
  const confirmBody = method('confirmDemolition');
  const removeBody = method('removeSelected');
  assert.match(confirmBody, /confirmDestructiveActions/);
  assert.match(confirmBody, /confirm\(/);
  assert.match(removeBody, /this\.confirmDemolition/);
  assert.match(removeBody, /this\.recordHistory\(\)/);
  assert.match(removeBody, /this\.clearSelection\(\)/);
});

check('Undo and Redo cancel an in-progress relocation first', () => {
  assert.match(method('undo'), /if \(this\.relocationState\) this\.cancelRelocation\(false\)/);
  assert.match(method('redo'), /if \(this\.relocationState\) this\.cancelRelocation\(false\)/);
});

console.log('building selection/actions contract: ' + passed + ' checks passed');
