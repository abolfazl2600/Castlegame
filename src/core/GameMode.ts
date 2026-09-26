import type { TileKind, ToolKind } from './types';

export type GameMode = "medieval" | "modern";

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
}

const MEDIEVAL_BUILDINGS: readonly TileKind[] = [
  'wall1','wall2','wall3','gate','tower','stairTower',
  'road','dirtRoad','stoneRoad','smallDock','woodenPier','harbor','fishingDock',
  'cottage','house','manor','villa','farm','appleOrchard','armyCamp',
  'marketStall','smallMarket','marketHall','windmill','mine','mountain','tree','rock','hut','moat',
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
      { label: 'Buildings', toolIds: ['cottage','house','manor','villa','marketStall','smallMarket','marketHall','farm','appleOrchard','windmill','mine','hut'] },
      { label: 'Defense', toolIds: ['wall1','wall2','wall3','gate','tower','towerBridge','keep','moat'] },
      { label: 'Military', toolIds: ['armyCamp'] },
      { label: 'Environment', toolIds: COMMON_WORLD_TOOLS },
      { label: 'Roads & Harbor', toolIds: ['road','dirtRoad','stoneRoad','smallDock','woodenPier','harbor','fishingDock'] },
    ],
    availableTools: [...MEDIEVAL_BUILDINGS, 'keep','towerBridge','mountainRange',...COMMON_WORLD_TOOLS],
    availableBuildingKinds: [...MEDIEVAL_BUILDINGS, 'tree','rock','mountain'],
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
  },
};

export function getGameModeDefinition(mode: GameMode): GameModeDefinition {
  return GAME_MODE_CONFIG[mode];
}

export function isGameMode(value: unknown): value is GameMode {
  return value === 'medieval' || value === 'modern';
}

export function isToolAvailable(mode: GameMode, tool: ToolKind): boolean {
  return GAME_MODE_CONFIG[mode].availableTools.includes(tool);
}

export function isBuildingAvailable(mode: GameMode, kind: TileKind): boolean {
  return GAME_MODE_CONFIG[mode].availableBuildingKinds.includes(kind);
}
