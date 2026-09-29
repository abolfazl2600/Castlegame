import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [threeGame, gameMode] = await Promise.all([
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/GameMode.ts', import.meta.url), 'utf8'),
]);

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

const registry = between(
  threeGame,
  'const TOOL_GROUPS:',
  'export class ThreeGame',
);

const definitionIds = [
  ...registry.matchAll(/\bid:\s*'([^']+)'/g),
].map((match) => match[1]);
const definitionSet = new Set(definitionIds);

assert.equal(
  definitionIds.length,
  definitionSet.size,
  'TOOL_GROUPS must not contain duplicate tool definitions.',
);
const sandbox = between(
  gameMode,
  '  sandbox: {',
  '\n};',
);
const shortcutMap = between(
  threeGame,
  'const shortcutMap: Record<string, ToolKind> = {',
  '      };',
);

assert.doesNotMatch(registry, /futuristicCastle|Modern & Futuristic|Modern Fortress/);
assert.doesNotMatch(gameMode, /\bmodern\b|futuristicCastle/);
assert.doesNotMatch(shortcutMap, /futuristicCastle/);
assert.doesNotMatch(threeGame, /FuturisticCastleRenderer|futuristicCastle|futuristic-castle/);
const selection = between(
  threeGame,
  'private selectTool(tool: ToolKind | null): void {',
  'private setStatus(text: string): void {',
);
assert.match(
  selection,
  /tool !== null && !this\.isToolAvailable\(tool\)/,
  'Tool selection must remain gated by the active game mode.',
);

const placement = between(
  threeGame,
  'const selectedTile = this.selectedTool as TileKind;',
  'private canBuildMarketAt(',
);
assert.match(
  placement,
  /!this\.isBuildingAvailable\(selectedTile\)/,
  'Placement must remain gated by availableBuildingKinds.',
);
assert.match(
  placement,
  /this\.services\.state\.setCell\(gx, gy, selectedTile, 1\)/,
  'Generic build placement must write the selected building kind.',
);
// Preserve the current UI surface while preventing future config/registry drift.
// These pre-existing gaps are intentionally allowlisted until they receive their own ToolDefinitions.
const LEGACY_REGISTRY_GAPS = new Set(['mine', 'hut', 'rock']);

const constBodies = new Map();
for (const match of gameMode.matchAll(/const\s+([A-Z_]+)[^=]*=\s*\[([\s\S]*?)\];/g)) {
  constBodies.set(match[1], match[2]);
}

function resolveToolExpression(expression, seen = new Set()) {
  const trimmed = expression.trim();
  const ids = [...trimmed.matchAll(/'([^']+)'/g)].map((match) => match[1]);

  for (const spread of trimmed.matchAll(/\.\.\.([A-Z_]+)/g)) {
    const name = spread[1];
    if (seen.has(name)) continue;
    seen.add(name);
    const body = constBodies.get(name);
    assert.ok(body, `Unknown tool list constant: ${name}`);
    ids.push(...resolveToolExpression(body, seen));
  }

  if (/^[A-Z_]+$/.test(trimmed) && !seen.has(trimmed)) {
    seen.add(trimmed);
    const body = constBodies.get(trimmed);
    assert.ok(body, `Unknown tool list constant: ${trimmed}`);
    ids.push(...resolveToolExpression(body, seen));
  }

  return ids;
}

const referencedTools = [];
for (const match of gameMode.matchAll(/toolIds:\s*(\[[^\]]*\]|[A-Z_]+)/g)) {
  referencedTools.push(...resolveToolExpression(match[1]));
}

const unresolved = [...new Set(referencedTools)]
  .filter((id) => !definitionSet.has(id))
  .filter((id) => !LEGACY_REGISTRY_GAPS.has(id));

assert.deepEqual(
  unresolved,
  [],
  `Every newly referenced visible tool must resolve to TOOL_GROUPS. Missing: ${unresolved.join(', ')}`,
);

console.log('Build tool registry regression checks passed.');
