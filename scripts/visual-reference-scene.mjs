/** Fixed save data for visual comparisons. Never seed from Math.random(). */
import { readFileSync } from 'node:fs';

const constants = readFileSync(new URL('../src/core/constants.ts', import.meta.url), 'utf8');
const saveVersion = Number(constants.match(/export const SAVE_VERSION = (\d+)/)?.[1]);
if (!Number.isInteger(saveVersion)) throw new Error('Could not read SAVE_VERSION');

export const REFERENCE_SEED = 6001;

const worldStyle = readFileSync(new URL('../src/rendering/WorldStyle.ts', import.meta.url), 'utf8');
const cameraPositionMatch = worldStyle.match(/position:\s*new THREE\.Vector3\(([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\)/);
const nearMatch = worldStyle.match(/nearInspection:\s*([\d.]+)/);
const normalMatch = worldStyle.match(/normalGameplay:\s*([\d.]+)/);
const strategicMatch = worldStyle.match(/maximumStrategic:\s*([\d.]+)/);
if (!cameraPositionMatch || !nearMatch || !normalMatch || !strategicMatch) {
  throw new Error('Could not read shared gameplay camera references from WorldStyle');
}

const cameraDirection = {
  x: Number(cameraPositionMatch[1]),
  y: Number(cameraPositionMatch[2]),
  z: Number(cameraPositionMatch[3]),
};
const directionLength = Math.hypot(cameraDirection.x, cameraDirection.y, cameraDirection.z);
const cameraAt = (distance) => ({
  x: cameraDirection.x / directionLength * distance,
  y: cameraDirection.y / directionLength * distance,
  z: cameraDirection.z / directionLength * distance,
  targetX: 0,
  targetY: 0,
  targetZ: 0,
});

export const REFERENCE_CAMERA = {
  near: cameraAt(Number(nearMatch[1])),
  normal: cameraAt(Number(normalMatch[1])),
  far: cameraAt(Number(strategicMatch[1])),
};

const cell = (x, y, kind, level = 1, extra = {}) => ({ x, y, kind, level, ...extra });

const REFERENCE_CELLS = [
  cell(12, 6, 'tree'), cell(13, 6, 'tree'), cell(16, 6, 'tree'),
  cell(12, 7, 'cottage'), cell(13, 7, 'house'), cell(14, 7, 'manor'), cell(15, 7, 'villa'),
  cell(12, 8, 'stoneRoad'), cell(13, 8, 'stoneRoad'), cell(14, 8, 'stoneRoad'), cell(15, 8, 'stoneRoad'), cell(16, 8, 'stoneRoad'),
  cell(12, 9, 'farm'), cell(13, 9, 'appleOrchard'), cell(14, 9, 'cowBarn'), cell(15, 9, 'market'), cell(16, 9, 'windmill'),
  cell(12, 10, 'road'), cell(13, 10, 'road'), cell(14, 10, 'road'), cell(15, 10, 'road'), cell(16, 10, 'road'),
  cell(12, 12, 'wall1', 1, { battlement: true, walkway: true }), cell(13, 12, 'gate'), cell(14, 12, 'tower'), cell(15, 12, 'wall1', 1, { battlement: true, walkway: true }),
  cell(12, 13, 'tree'), cell(16, 13, 'tree'), cell(17, 12, 'tree'),
];

function starterCells() {
  return [
    cell(9, 8, 'cottage'), cell(10, 8, 'house'), cell(11, 8, 'hut'),
    cell(9, 9, 'dirtRoad'), cell(10, 9, 'dirtRoad'), cell(11, 9, 'dirtRoad'), cell(12, 9, 'dirtRoad'),
    cell(9, 10, 'farm', 1), cell(11, 10, 'appleOrchard', 1), cell(12, 10, 'market'),
    cell(8, 7, 'tree', 2), cell(12, 7, 'tree', 1), cell(13, 10, 'tree', 3),
    cell(9, 12, 'wall1', 1, { battlement: true }), cell(10, 12, 'gate', 1), cell(11, 12, 'wall1', 1, { battlement: true }),
  ];
}

function denseCells() {
  const positions = new Map(REFERENCE_CELLS.map((entry) => [`${entry.x},${entry.y}`, { ...entry }]));
  const variants = ['cottage', 'house', 'manor', 'villa', 'farm', 'appleOrchard', 'market', 'tree'];
  for (let y = 4; y <= 17; y += 1) {
    for (let x = 4; x <= 17; x += 1) {
      const key = `${x},${y}`;
      if (positions.has(key) || (x >= 12 && x <= 15 && y >= 12 && y <= 15)) continue;
      const kind = (x % 4 === 0 || y % 4 === 0)
        ? 'dirtRoad'
        : variants[(x * 7 + y * 11 + REFERENCE_SEED) % variants.length];
      const level = ['farm', 'appleOrchard'].includes(kind)
        ? 1 + ((x * 3 + y * 5) % 4)
        : 1;
      positions.set(key, cell(x, y, kind, level));
    }
  }
  positions.set('6,6', cell(6, 6, 'basilica'));
  positions.set('17,6', cell(17, 6, 'windmill'));
  positions.set('6,16', cell(6, 16, 'armyCamp', 4));
  return [...positions.values()];
}

function castleCells() {
  const cells = [];
  for (let x = 5; x <= 16; x += 1) {
    const northDamage = x === 8 ? 0.22 : x === 10 ? 0.54 : x === 12 ? 0.84 : 0;
    cells.push(cell(x, 5, x === 10 ? 'gate' : x === 5 || x === 16 ? 'tower' : 'wall3',
      x === 10 ? 4 : x === 5 || x === 16 ? 4 : 1,
      x === 10
        ? { rotation: 0 }
        : x === 5 || x === 16
          ? { towerShape: x === 5 ? 'round' : 'corner', towerTop: 'openBattlement' }
          : { thickness: 'thick', battlement: true, walkway: true, damage: northDamage }));
    cells.push(cell(x, 16, x === 5 || x === 16 ? 'tower' : 'wall1',
      x === 5 || x === 16 ? 3 : 1,
      x === 5 || x === 16
        ? { towerShape: x === 5 ? 'octagonal' : 'watch', towerTop: 'battlement' }
        : { battlement: true, walkway: true }));
  }
  for (let y = 6; y <= 15; y += 1) {
    cells.push(cell(5, y, 'wall2', 1, { battlement: true, walkway: true }));
    cells.push(cell(16, y, 'wall3', 1, { thickness: 'thick', battlement: true, walkway: true }));
  }
  cells.push(cell(8, 9, 'armyCamp', 4));
  cells.push(cell(13, 9, 'armyCamp', 3));
  cells.push(cell(7, 13, 'market'));
  cells.push(cell(14, 13, 'basilica'));
  cells.push(cell(10, 14, 'house'));
  cells.push(cell(12, 14, 'manor'));
  return cells;
}

function farmDistrictCells() {
  const cells = [];
  for (let level = 1; level <= 4; level += 1) {
    const x = 5 + (level - 1) * 4;
    cells.push(cell(x, 6, 'farm', level));
    cells.push(cell(x, 10, 'cowBarn', level));
    cells.push(cell(x, 14, 'appleOrchard', level));
    cells.push(cell(x, 18, 'armyCamp', level));
  }
  for (let x = 4; x <= 18; x += 1) {
    cells.push(cell(x, 8, 'dirtRoad'));
    cells.push(cell(x, 12, 'dirtRoad'));
    cells.push(cell(x, 16, 'stoneRoad'));
  }
  cells.push(cell(3, 10, 'windmill'));
  cells.push(cell(19, 10, 'market'));
  cells.push(cell(3, 14, 'cottage'));
  cells.push(cell(19, 14, 'villa'));
  return cells;
}

function harborDistrictCells() {
  return [
    cell(5, 16, 'harbor', 1, { shipKind: 'fishingBoat' }),
    cell(8, 16, 'harbor', 2, { shipKind: 'fishingBoat' }),
    cell(11, 16, 'harbor', 3, { shipKind: 'tradingBoat' }),
    cell(14, 16, 'harbor', 4, { shipKind: 'transportShip' }),
    cell(5, 13, 'cottage'), cell(8, 13, 'house'), cell(11, 13, 'market'), cell(14, 13, 'windmill'),
    cell(5, 12, 'stoneRoad'), cell(6, 12, 'stoneRoad'), cell(7, 12, 'stoneRoad'), cell(8, 12, 'stoneRoad'),
    cell(9, 12, 'stoneRoad'), cell(10, 12, 'stoneRoad'), cell(11, 12, 'stoneRoad'), cell(12, 12, 'stoneRoad'),
    cell(13, 12, 'stoneRoad'), cell(14, 12, 'stoneRoad'),
    cell(4, 11, 'tree', 2), cell(15, 11, 'tree', 3),
  ];
}

function sceneDefinition(kind) {
  if (kind === 'empty') return { mode: 'medieval', layout: 'mainland', cells: [], keeps: [] };
  if (kind === 'reference') return {
    mode: 'medieval', layout: 'mainland', cells: REFERENCE_CELLS.map((entry) => ({ ...entry })),
    keeps: [{ id: 1, x: 13, y: 14, width: 2, depth: 2, floors: 2, rotation: 0, cornerTowers: true, roof: 'flatBattlement', battlements: true, seed: REFERENCE_SEED }],
  };
  if (kind === 'dense') return {
    mode: 'medieval', layout: 'mainland', cells: denseCells(),
    keeps: [{ id: 1, x: 13, y: 14, width: 2, depth: 2, floors: 3, rotation: 0, cornerTowers: true, roof: 'towered', battlements: true, seed: REFERENCE_SEED + 1 }],
  };
  if (kind === 'starter') return { mode: 'medieval', layout: 'mainland', cells: starterCells(), keeps: [] };
  if (kind === 'castle') return {
    mode: 'medieval', layout: 'mainland', cells: castleCells(),
    keeps: [{ id: 2, x: 10, y: 10, width: 3, depth: 3, floors: 4, rotation: 0, cornerTowers: true, roof: 'towered', battlements: true, seed: REFERENCE_SEED + 2 }],
  };
  if (kind === 'farm') return { mode: 'medieval', layout: 'mainland', cells: farmDistrictCells(), keeps: [] };
  if (kind === 'harbor') return { mode: 'medieval', layout: 'peninsula', cells: harborDistrictCells(), keeps: [] };
  throw new Error(`Unknown scene: ${kind}`);
}

export const FINAL_QA_SCENES = ['starter', 'dense', 'castle', 'farm', 'harbor'];

export function createVisualScene(kind = 'reference') {
  const definition = sceneDefinition(kind);
  const cells = definition.cells;
  const keeps = definition.keeps;
  const terrain = cells
    .filter(({ kind: tileKind }) => tileKind !== 'harbor')
    .map(({ x, y }) => ({ x, y, kind: 'plains' }));
  const now = 1_700_000_000_000;
  return {
    metadata: {
      id: `visual-${kind}-${REFERENCE_SEED}`,
      slot: 'autosave',
      name: `Visual ${kind}`,
      createdAt: now,
      updatedAt: now,
      schemaVersion: saveVersion,
      gameMode: definition.mode,
      summary: { buildings: cells.length, keeps: keeps.length, terrainChanges: terrain.length, elevations: 0 },
    },
    data: {
      version: saveVersion,
      gameMode: definition.mode,
      mapLayoutId: definition.layout,
      worldSeed: REFERENCE_SEED,
      updatedAt: now,
      cells,
      keeps,
      stoneStyle: 'limestone',
      towerBridges: [],
      terrain,
      elevations: [],
      worldSeeded: true,
      militaryTier: 4,
    },
  };
}
