import type { TileKind, ToolKind } from './types';

/**
 * The game now has one canonical ruleset. Legacy mode names are accepted only
 * while reading older saves and are normalized to this value.
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
  'market','basilica','mosque','windmill','mine','mountain','tree','rock','hut','moat',
];

const WORLD_TOOLS: readonly ToolKind[] = [
  'tree','rock','mountain','mountainRange','river','land','raise','lower','flatten','smooth','hill','cliff','erase',
];

const ALL_TOOLS: readonly ToolKind[] = [
  ...BUILDINGS,
  'keep',
  'towerBridge',
  'mountainRange',
  ...WORLD_TOOLS,
];

export const GAME_DEFINITION: GameDefinition = {
  id: 'unified',
  label: 'Castle Role',
  description: 'The complete castle-building, economy, battle, world-editing, and God Mode experience.',
  toolGroups: [
    { label: 'Castle & Defense', toolIds: ['wall1','wall2','wall3','gate','tower','towerBridge','keep','moat'] },
    { label: 'Buildings', toolIds: ['cottage','house','manor','villa','market','basilica','mosque','farm','cowBarn','appleOrchard','windmill','mine','hut'] },
    { label: 'Roads & Harbor', toolIds: ['road','dirtRoad','stoneRoad','harbor'] },
    { label: 'Military', toolIds: ['armyCamp'] },
    { label: 'Environment', toolIds: ['tree','rock','mountain'] },
    { label: 'Terrain', toolIds: ['mountainRange','river','land','raise','lower','flatten','smooth','hill','cliff','erase'] },
  ],
  availableTools: ALL_TOOLS,
  availableBuildingKinds: BUILDINGS,
  availableUnits: ['swordsman','spearman','archer','crossbowman'],
  availableWeapons: ['sword','spear','bow','crossbow'],
};

export function getGameModeDefinition(_mode: GameMode = 'unified'): GameDefinition {
  return GAME_DEFINITION;
}

export function isGameMode(value: unknown): value is GameMode {
  return value === 'unified';
}

/** Backward-compatible save migration only; legacy modes no longer exist at runtime. */
export function normalizeGameMode(value: unknown): GameMode {
  if (value === 'unified' || value === 'medieval' || value === 'survival' || value === 'sandbox') {
    return 'unified';
  }
  return 'unified';
}

export function isToolAvailable(_mode: GameMode, tool: ToolKind): boolean {
  return GAME_DEFINITION.availableTools.includes(tool);
}

export function isBuildingAvailable(_mode: GameMode, kind: TileKind): boolean {
  return GAME_DEFINITION.availableBuildingKinds.includes(kind);
}

export function isMedievalMode(_mode: GameMode): boolean {
  return true;
}

export function isUnitAvailable(_mode: GameMode, unit: string): boolean {
  return GAME_DEFINITION.availableUnits.includes(unit);
}

export function isWeaponAvailable(_mode: GameMode, weapon: string): boolean {
  return GAME_DEFINITION.availableWeapons.includes(weapon);
}
