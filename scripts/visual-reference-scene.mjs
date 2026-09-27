/** Fixed save data for visual comparisons. Never seed from Math.random(). */
import { readFileSync } from 'node:fs';

const constants = readFileSync(new URL('../src/core/constants.ts', import.meta.url), 'utf8');
const saveVersion = Number(constants.match(/export const SAVE_VERSION = (\d+)/)?.[1]);
if (!Number.isInteger(saveVersion)) throw new Error('Could not read SAVE_VERSION');

export const REFERENCE_SEED = 6001;
export const REFERENCE_CAMERA = {
  normal: { x: 68, y: 80, z: 76, targetX: 0, targetY: 0, targetZ: 0 },
  near: { x: 43, y: 50, z: 48, targetX: 0, targetY: 0, targetZ: 0 },
  far: { x: 91, y: 108, z: 102, targetX: 0, targetY: 0, targetZ: 0 },
};

const referenceCells = [
  [12, 6, 'tree'], [13, 6, 'tree'], [16, 6, 'tree'],
  [12, 7, 'cottage'], [13, 7, 'house'], [14, 7, 'manor'], [15, 7, 'villa'],
  [12, 8, 'stoneRoad'], [13, 8, 'stoneRoad'], [14, 8, 'stoneRoad'], [15, 8, 'stoneRoad'], [16, 8, 'stoneRoad'],
  [12, 9, 'farm'], [13, 9, 'appleOrchard'], [14, 9, 'cowBarn'], [15, 9, 'market'], [16, 9, 'windmill'],
  [12, 10, 'road'], [13, 10, 'road'], [14, 10, 'road'], [15, 10, 'road'], [16, 10, 'road'],
  [12, 12, 'wall1'], [13, 12, 'gate'], [14, 12, 'tower'], [15, 12, 'wall1'],
  [12, 13, 'tree'], [16, 13, 'tree'], [17, 12, 'tree'],
];

export function createVisualScene(kind = 'reference') {
  if (!['empty', 'reference', 'dense'].includes(kind)) throw new Error(`Unknown scene: ${kind}`);
  const positions = new Map();
  if (kind !== 'empty') {
    for (const [x, y, tileKind] of referenceCells) positions.set(`${x},${y}`, { x, y, kind: tileKind, level: 1 });
  }
  if (kind === 'dense') {
    const variants = ['cottage', 'house', 'manor', 'villa', 'farm', 'appleOrchard', 'market', 'tree'];
    for (let y = 4; y <= 17; y += 1) {
      for (let x = 4; x <= 16; x += 1) {
        const key = `${x},${y}`;
        if (positions.has(key) || (x >= 12 && x <= 15 && y >= 12 && y <= 15)) continue;
        const kind = (x % 4 === 0 || y % 4 === 0) ? 'dirtRoad' : variants[(x * 7 + y * 11 + REFERENCE_SEED) % variants.length];
        positions.set(key, { x, y, kind, level: 1 });
      }
    }
  }
  const cells = [...positions.values()];
  const keeps = kind === 'empty' ? [] : [{ id: 1, x: 13, y: 14, width: 2, depth: 2, floors: 2,
    rotation: 0, cornerTowers: true, roof: 'flatBattlement', battlements: true, seed: REFERENCE_SEED }];
  // Keep the coastline outside the built area; avoid terrain-driven placement differences.
  const terrain = kind === 'empty' ? [] : cells.map(({ x, y }) => ({ x, y, kind: 'plains' }));
  const now = 1_700_000_000_000;
  return {
    metadata: { id: `visual-${kind}-${REFERENCE_SEED}`, slot: 'autosave', name: `Visual ${kind}`,
      createdAt: now, updatedAt: now, schemaVersion: saveVersion, gameMode: 'medieval',
      summary: { buildings: cells.length, keeps: keeps.length, terrainChanges: terrain.length, elevations: 0 } },
    data: { version: saveVersion, gameMode: 'medieval', mapLayoutId: 'mainland', updatedAt: now,
      cells, keeps, stoneStyle: 'limestone', towerBridges: [], terrain, elevations: [], worldSeeded: true },
  };
}
