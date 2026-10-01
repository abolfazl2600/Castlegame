import type { TileKind, ToolKind } from './types';

/**
 * Castle Role has one canonical gameplay ruleset. The legacy mode names are
 * accepted only while reading older saves and normalize into this single mode.
 */
export type GameMode = 'unified';

export interface GameToolGroup {
  label: string;
  toolIds: readonly ToolKind[];
}

export interface GameDefinition {
  id: GameMode;
  label: string;
  description: string;
  toolGroups: readonly GameToolGroup[];
  availableTools: readonly ToolKind[];
  availableBuildingKinds: readonly TileKind[];
  availableUnits: readonly string[];
  availableWeapons: readonly string[];
}

const BUILDINGS: readonly TileKind[] = [
  'wall1','wall2','wall3','gate','tower',
  'road','dirtRoad','stoneRoad','harbor',
  'cottage','house','manor','villa','farm','cowBarn','appleOrchard','armyCamp',
  'market','basilica','mosque','windmill','mine','carpenter','mountain','tree','rock','hut','moat',
];

const WORLD_TOOLS: readonly ToolKind[] = [
  'tree','rock','mountain','mountainRange','river','land','raise','lower','flatten','smooth','hill','cliff','erase',
];

const ALL_TOOLS: readonly ToolKind[] = [...new Set<ToolKind>([
  ...BUILDINGS,
  'keep',
  'towerBridge',
  'mountainRange',
  ...WORLD_TOOLS,
])];

export const GAME_DEFINITION: GameDefinition = {
  id: 'unified',
  label: 'Castle Role',
  description: 'The complete castle-building, economy, battle, endless-defense, world-editing, and God Mode experience.',
  toolGroups: [
    { label: 'Castle & Defense', toolIds: ['wall1','wall2','wall3','gate','tower','towerBridge','keep','moat'] },
    { label: 'Buildings', toolIds: ['cottage','house','manor','villa','market','basilica','mosque','carpenter','farm','cowBarn','appleOrchard','windmill','mine','hut'] },
    { label: 'Roads & Harbor', toolIds: ['road','dirtRoad','stoneRoad','harbor'] },
    { label: 'Military', toolIds: ['armyCamp'] },
    { label: 'Environment', toolIds: ['tree','rock','mountain'] },
    { label: 'Terrain', toolIds: ['raise','lower','flatten'] },
    { label: 'Advanced World', toolIds: ['mountainRange','river','land','smooth','hill','cliff','erase'] },
  ],
  availableTools: ALL_TOOLS,
  availableBuildingKinds: BUILDINGS,
  availableUnits: ['swordsman','spearman','archer','crossbowman'],
  availableWeapons: ['sword','spear','bow','crossbow'],
};

/** Backward-compatible save migration only; legacy modes no longer exist at runtime. */
export function normalizeGameMode(value: unknown): GameMode {
  if (value === 'unified' || value === 'medieval' || value === 'survival' || value === 'sandbox') {
    return 'unified';
  }
  return 'unified';
}

export function isToolAvailable(tool: ToolKind): boolean {
  return GAME_DEFINITION.availableTools.includes(tool);
}

export function isBuildingAvailable(kind: TileKind): boolean {
  return GAME_DEFINITION.availableBuildingKinds.includes(kind);
}
