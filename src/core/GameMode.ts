import type { TileKind, ToolKind } from './types';

export type GameMode = "medieval" | "modern" | "survival";

export interface GameModeToolGroup {
  label: string;
  toolIds: readonly ToolKind[];
}

export interface GameModeDefinition {
  id: GameMode;
  label: string;
  description: string;
  toolGroups: readonly GameModeToolGroup[];
  availableTools: readonly ToolKind[];
  availableBuildingKinds: readonly TileKind[];
  availableUnits: readonly string[];
  availableWeapons: readonly string[];
}

const MEDIEVAL_BUILDINGS: readonly TileKind[] = [
  'wall1','wall2','wall3','gate','tower','stairTower',
  'road','dirtRoad','stoneRoad','smallDock','woodenPier','harbor','fishingDock',
  'cottage','house','manor','villa','farm','appleOrchard','armyCamp',
  'market','windmill','mine','mountain','tree','rock','hut','moat',
  'stoneStairs','woodenStairs','ramp','ladder',
];

const COMMON_WORLD_TOOLS: readonly ToolKind[] = [
  'tree','rock','mountain','mountainRange','river','land','raise','lower','flatten','smooth','dig','hill','cliff','erase',
];

export const GAME_MODE_CONFIG: Record<GameMode, GameModeDefinition> = {
  medieval: {
    id: 'medieval',
    label: 'Medieval Castle',
    description: 'Stone fortifications, medieval buildings, soldiers, and siege systems.',
    toolGroups: [
      { label: 'Castle', toolIds: ['wall1','wall2','wall3','gate','tower','stairTower','towerBridge','keep','moat'] },
      { label: 'Buildings', toolIds: ['cottage','house','manor','villa','market','farm','appleOrchard','windmill','mine','hut'] },
      { label: 'Defense', toolIds: ['wall1','wall2','wall3','gate','tower','towerBridge','keep','moat'] },
      { label: 'Military', toolIds: ['armyCamp'] },
      { label: 'Environment', toolIds: COMMON_WORLD_TOOLS },
      { label: 'Roads & Harbor', toolIds: ['road','dirtRoad','stoneRoad','smallDock','woodenPier','harbor','fishingDock'] },
    ],
    availableTools: [...MEDIEVAL_BUILDINGS, 'keep','towerBridge','mountainRange',...COMMON_WORLD_TOOLS],
    availableBuildingKinds: [...MEDIEVAL_BUILDINGS, 'tree','rock','mountain'],
    availableUnits: ['swordsman','spearman','archer','crossbowman'],
    availableWeapons: ['sword','spear','bow','crossbow'],
  },
  survival: {
    id: 'survival',
    label: 'Survival',
    description: 'Endless wave defense using the existing castle, enemy, combat, and navigation systems.',
    toolGroups: [
      { label: 'Castle', toolIds: ['wall1','wall2','wall3','gate','tower','stairTower','towerBridge','keep','moat'] },
      { label: 'Buildings', toolIds: ['cottage','house','manor','villa','market','farm','appleOrchard','windmill','mine','hut'] },
      { label: 'Defense', toolIds: ['wall1','wall2','wall3','gate','tower','towerBridge','keep','moat'] },
      { label: 'Military', toolIds: ['armyCamp'] },
      { label: 'Environment', toolIds: COMMON_WORLD_TOOLS },
      { label: 'Roads & Harbor', toolIds: ['road','dirtRoad','stoneRoad','smallDock','woodenPier','harbor','fishingDock'] },
    ],
    availableTools: [...MEDIEVAL_BUILDINGS, 'keep','towerBridge','mountainRange',...COMMON_WORLD_TOOLS],
    availableBuildingKinds: [...MEDIEVAL_BUILDINGS, 'tree','rock','mountain'],
    availableUnits: ['swordsman','spearman','archer','crossbowman'],
    availableWeapons: ['sword','spear','bow','crossbow'],
  },
  modern: {
    id: 'modern',
    label: 'Modern Fortress',
    description: 'Modern/futuristic fortress architecture. Only implemented modern systems are enabled.',
    toolGroups: [
      { label: 'Fortress', toolIds: ['futuristicCastle'] },
      { label: 'Buildings', toolIds: [] },
      { label: 'Defense', toolIds: [] },
      { label: 'Military', toolIds: [] },
      { label: 'Weapons', toolIds: [] },
      { label: 'Infrastructure', toolIds: [] },
      { label: 'Environment', toolIds: COMMON_WORLD_TOOLS },
    ],
    availableTools: ['futuristicCastle', ...COMMON_WORLD_TOOLS],
    availableBuildingKinds: ['futuristicCastle','tree','rock','mountain'],
    availableUnits: [],
    availableWeapons: [],
  },
};

export function getGameModeDefinition(mode: GameMode): GameModeDefinition {
  return GAME_MODE_CONFIG[mode];
}

export function isGameMode(value: unknown): value is GameMode {
  return value === 'medieval' || value === 'modern' || value === 'survival';
}

export function isToolAvailable(mode: GameMode, tool: ToolKind): boolean {
  return GAME_MODE_CONFIG[mode].availableTools.includes(tool);
}

export function isBuildingAvailable(mode: GameMode, kind: TileKind): boolean {
  return GAME_MODE_CONFIG[mode].availableBuildingKinds.includes(kind);
}

export function isMedievalMode(mode: GameMode): boolean {
  return mode === 'medieval';
}

export function isModernMode(mode: GameMode): boolean {
  return mode === 'modern';
}

export function isUnitAvailable(mode: GameMode, unit: string): boolean {
  return GAME_MODE_CONFIG[mode].availableUnits.includes(unit);
}

export function isWeaponAvailable(mode: GameMode, weapon: string): boolean {
  return GAME_MODE_CONFIG[mode].availableWeapons.includes(weapon);
}
