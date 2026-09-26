import type { BattleScenario } from './BattleObjectiveTypes';

export const DEFAULT_BATTLE_SCENARIO: BattleScenario = {
  id: 'default-battle',
  primaryObjectives: [
    {
      id: 'default-elimination',
      type: 'eliminate_army',
      title: 'Eliminate Enemy Army',
      description: 'Defeat all enemy forces.',
      priority: 'primary',
      ownerFaction: 'attacker',
      configuration: { faction: 'defender', requiredCount: 'all' },
    },
    {
      id: 'default-castle-capture',
      type: 'capture_keep',
      title: 'Capture the Castle',
      description: 'Capture the castle objective.',
      priority: 'primary',
      ownerFaction: 'attacker',
      target: { keepId: 'castle-objective' },
      configuration: { useBattleCaptureProgress: true, requiredProgress: 1 },
    },
  ],
  victory: { mode: 'any_primary' },
};
