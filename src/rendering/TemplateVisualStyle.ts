import type { StoneStyle, TowerBridgeKind } from '../core/types';

export interface TemplateVisualPreset {
  stoneStyle: StoneStyle;
  towerBridgeKind: TowerBridgeKind;
  family: 'medieval';
}

/**
 * Stable visual family for every complete starting-world template.
 *
 * Templates should compose the shared world, settlement, and castle
 * rendering kits. This registry only selects existing style roles; it does not
 * introduce template-specific materials.
 */
export const TEMPLATE_VISUAL_PRESETS: Readonly<Record<string, TemplateVisualPreset>> = {
  'mainland-frontier': { stoneStyle: 'frontier', towerBridgeKind: 'wood', family: 'medieval' },
  'coastal-peninsula': { stoneStyle: 'limestone', towerBridgeKind: 'stone', family: 'medieval' },
  'split-isles': { stoneStyle: 'sandstone', towerBridgeKind: 'wood', family: 'medieval' },
  'carcassonne': { stoneStyle: 'limestone', towerBridgeKind: 'stone', family: 'medieval' },
  'himeji-castle': { stoneStyle: 'whitePlaster', towerBridgeKind: 'stone', family: 'medieval' },
  'empty-land': { stoneStyle: 'limestone', towerBridgeKind: 'stone', family: 'medieval' },
  'small-castle': { stoneStyle: 'limestone', towerBridgeKind: 'stone', family: 'medieval' },
  'motte-bailey': { stoneStyle: 'frontier', towerBridgeKind: 'wood', family: 'medieval' },
  'river-castle': { stoneStyle: 'limestone', towerBridgeKind: 'stone', family: 'medieval' },
  'mountain-valley': { stoneStyle: 'frontier', towerBridgeKind: 'stone', family: 'medieval' },
  'coastal-kingdom': { stoneStyle: 'limestone', towerBridgeKind: 'stone', family: 'medieval' },
  'highland-river': { stoneStyle: 'frontier', towerBridgeKind: 'wood', family: 'medieval' },
  'grand-citadel': { stoneStyle: 'limestone', towerBridgeKind: 'stone', family: 'medieval' },
  'dark-fortress': { stoneStyle: 'darkStone', towerBridgeKind: 'stone', family: 'medieval' },
  'sandstone-oasis': { stoneStyle: 'sandstone', towerBridgeKind: 'stone', family: 'medieval' },
  'frontier-outpost': { stoneStyle: 'frontier', towerBridgeKind: 'wood', family: 'medieval' },
  'bridge-stronghold': { stoneStyle: 'limestone', towerBridgeKind: 'stone', family: 'medieval' },
  'siege-academy': { stoneStyle: 'darkStone', towerBridgeKind: 'stone', family: 'medieval' },
  'harbor-capital': { stoneStyle: 'limestone', towerBridgeKind: 'wood', family: 'medieval' },
  'mountain-fortress': { stoneStyle: 'frontier', towerBridgeKind: 'stone', family: 'medieval' },
  'royal-city': { stoneStyle: 'sandstone', towerBridgeKind: 'stone', family: 'medieval' },
  'architecture-gallery': { stoneStyle: 'limestone', towerBridgeKind: 'stone', family: 'medieval' },
  'river-port-fort': { stoneStyle: 'limestone', towerBridgeKind: 'wood', family: 'medieval' },
  'farming-duchy': { stoneStyle: 'sandstone', towerBridgeKind: 'wood', family: 'medieval' },
  'twin-keep': { stoneStyle: 'darkStone', towerBridgeKind: 'stone', family: 'medieval' },
  'border-march': { stoneStyle: 'frontier', towerBridgeKind: 'wood', family: 'medieval' },
  'forest-citadel': { stoneStyle: 'limestone', towerBridgeKind: 'stone', family: 'medieval' },
  'cliff-watch': { stoneStyle: 'darkStone', towerBridgeKind: 'stone', family: 'medieval' },
  'moat-palace': { stoneStyle: 'sandstone', towerBridgeKind: 'stone', family: 'medieval' },
  'merchant-republic': { stoneStyle: 'limestone', towerBridgeKind: 'wood', family: 'medieval' },
  'war-camp': { stoneStyle: 'frontier', towerBridgeKind: 'wood', family: 'medieval' },
  'island-monastery': { stoneStyle: 'limestone', towerBridgeKind: 'stone', family: 'medieval' },
};

const DEFAULT_TEMPLATE_VISUAL_PRESET: TemplateVisualPreset = {
  stoneStyle: 'limestone',
  towerBridgeKind: 'stone',
  family: 'medieval',
};

export function getTemplateVisualPreset(template: string): TemplateVisualPreset {
  return TEMPLATE_VISUAL_PRESETS[template] ?? DEFAULT_TEMPLATE_VISUAL_PRESET;
}
