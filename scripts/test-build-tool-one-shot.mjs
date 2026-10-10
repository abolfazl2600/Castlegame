import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');

const method = (name) => {
  const start = source.indexOf('  private ' + name + '(');
  assert.ok(start >= 0, 'missing method: ' + name);
  const end = source.indexOf('\n  private ', start + 1);
  return source.slice(start, end < 0 ? source.length : end);
};

const selectTool = method('selectTool');
assert.match(selectTool, /announce = true/);
assert.match(selectTool, /if \(announce\)[\s\S]*this\.setStatus/);

const deactivate = method('deactivateBuildToolAfterCommit');
assert.match(deactivate, /selectedTool === null \|\| this\.selectedTool === 'erase'/);
assert.match(deactivate, /this\.selectTool\(null, false\)/);

const finishBuild = method('finishBuild');
assert.match(finishBuild, /deactivateTool = false/);
assert.match(finishBuild, /if \(deactivateTool\) this\.deactivateBuildToolAfterCommit\(\)/);

const towerBridge = method('handleTowerBridgeClick');
assert.match(towerBridge, /this\.finishBuild\(true\)/, 'completed Tower Bridge should be one-shot');

const click = method('handleBuildClick');
assert.ok(
  (click.match(/this\.finishBuild\(true\)/g) ?? []).length >= 13,
  'successful click-based build/terrain placements must deactivate their tool',
);
const eraseStart = click.indexOf("if (this.selectedTool === 'erase')");
const keepStart = click.indexOf("if (this.selectedTool === 'keep')");
const eraseBlock = click.slice(eraseStart, keepStart);
assert.doesNotMatch(eraseBlock, /finishBuild\(true\)/, 'Remove/erase is not a construction placement');

assert.match(method('buildWallDrag'), /if \(changed\)[\s\S]*deactivateBuildToolAfterCommit\(\)/);
assert.match(method('buildRoadDrag'), /if \(changed > 0\)[\s\S]*deactivateBuildToolAfterCommit\(\)/);
assert.match(method('buildMountainRange'), /deactivateBuildToolAfterCommit\(\)/);
assert.match(method('placeKeep'), /deactivateBuildToolAfterCommit\(\)/);

const pointerInput = method('bindPointerInput');
assert.match(
  pointerInput,
  /terrainStrokeChanged && this\.terrainStrokeSnapshot[\s\S]*deactivateBuildToolAfterCommit\(\)/,
  'a committed terrain stroke must be one-shot',
);

assert.match(
  click,
  /selectedTool === 'moat'[\s\S]*buildMoatStroke\(\[point\], false\)/,
  'single-tap moat placement delegates to the route transaction',
);
assert.match(
  method('buildMoatStroke'),
  /this\.moatTasks\.set[\s\S]*this\.deactivateBuildToolAfterCommit\(\)/,
  'successful connected moat excavation must be one-shot',
);

console.log('one-shot build tool contract checks passed');
