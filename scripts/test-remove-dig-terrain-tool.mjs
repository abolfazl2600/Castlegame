import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const threeGame = await readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const types = await readFile(new URL('../src/core/types.ts', import.meta.url), 'utf8');
const gameMode = await readFile(new URL('../src/core/GameMode.ts', import.meta.url), 'utf8');
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

// Dig must no longer exist as a selectable/editing tool.
assert.doesNotMatch(types, /TerrainToolKind[^\n]*'dig'/);
assert.doesNotMatch(gameMode, /['"]dig['"]/);
assert.doesNotMatch(threeGame, /id: 'dig'/);
assert.doesNotMatch(threeGame, /tool === 'dig'/);
assert.doesNotMatch(threeGame, /g: 'dig'/);
assert.doesNotMatch(threeGame, /['"]raise['"], ['"]lower['"], ['"]flatten['"], ['"]smooth['"], ['"]dig['"]/);

// Lower and the rest of terrain editing stay intact.
assert.match(types, /TerrainToolKind = 'raise' \| 'lower' \| 'flatten' \| 'smooth' \| 'hill' \| 'cliff'/);
assert.match(threeGame, /id: 'lower'[\s\S]*?label: 'Lower'[\s\S]*?shortcut: 'J'/);
assert.match(threeGame, /tool === 'lower'\) next = current - 0\.32 \* scaled/);
assert.match(threeGame, /next = THREE\.MathUtils\.clamp\(next, -1\.6, 6\)/);
assert.match(threeGame, /'raise', 'lower', 'flatten', 'smooth', 'hill', 'cliff'/);

// Already lowered/excavated worlds must still render their negative elevations.
assert.match(threeGame, /if \(elevation < -0\.03\)/);
assert.match(threeGame, /terrain-low-earth/);
assert.match(threeGame, /terrain-low-side/);
assert.match(threeGame, /elevationOverrides/);

// Moats still use their normal excavation gameplay path.
assert.match(threeGame, /selectedTool === 'moat'/);
assert.match(threeGame, /Workers assigned to dig moat/);

// UI/docs must not advertise Dig or G as Dig.
assert.doesNotMatch(html, /Smooth \/ Dig/);
assert.doesNotMatch(readme, /\*\*G\*\* — Dig/);
assert.doesNotMatch(readme, /^\s*- Dig\s*$/m);
assert.match(html, /Lower is the supported tool for decreasing terrain elevation/);

console.log('Dig terrain tool removed while Lower, saved elevations, low-terrain rendering, and moat behavior remain intact.');
