import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [game, types, save, constants, style, corners, battle, twin] = await Promise.all([
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/types.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/SaveSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/constants.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/rendering/CastleArchitectureStyle.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/building/WallCornerSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/battle/BattleSystem.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/world/TwinFortressesTemplate.ts', import.meta.url), 'utf8'),
]);

const gridCellStart = types.indexOf('export interface GridCell');
const gridCellEnd = types.indexOf('export interface TowerBridgeState');
assert.notEqual(gridCellStart, -1);
assert.notEqual(gridCellEnd, -1);
const gridCell = types.slice(gridCellStart, gridCellEnd);

assert.match(style, /export const CANONICAL_WALL_THICKNESS = 2\.04;/);
assert.match(style, /wall:\s*\{[\s\S]*?thickness: CANONICAL_WALL_THICKNESS,/);
assert.match(style, /tower:\s*\{[\s\S]*?connectorWidth: CANONICAL_WALL_THICKNESS,/);
assert.doesNotMatch(game, /wall-thickness|wallThickness|wallThicknessValue|cell\.thickness|neighbor\.thickness/);
assert.doesNotMatch(game, /thickness\s*:\s*['"](?:thin|medium|thick)['"]/);
assert.match(game, /const thickness = CASTLE_ARCHITECTURE_STYLE\.wall\.thickness;/);
assert.doesNotMatch(game, /thickness\s*>=\s*2\.3/);
assert.doesNotMatch(gridCell, /thickness\??:/);
assert.match(types, /Legacy save compatibility only[\s\S]*?export type WallThickness = 'thin' \| 'medium' \| 'thick';/);
assert.match(types, /export interface SavedGame[\s\S]*?thickness\?: WallThickness;/);
assert.doesNotMatch(save, /thickness:\s*cell\.thickness/);
assert.doesNotMatch(corners, /cell\.thickness|thickness === 'thick'/);
assert.doesNotMatch(battle, /cell\.thickness|const thickness =/);
assert.doesNotMatch(twin, /thickness\s*:\s*['"](?:thin|medium|thick)['"]/);
assert.match(constants, /export const SAVE_VERSION = 19;/);

console.log('standard wall thickness regression checks passed');
