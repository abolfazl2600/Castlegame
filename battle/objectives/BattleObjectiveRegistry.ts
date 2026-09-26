import type {
  BattleObjectiveDefinition,
  BattleObjectiveRuntimeState,
  ObjectiveContext,
  BattleObjectiveType,
} from './BattleObjectiveTypes';

export interface ObjectiveEvaluation {
  progress: number;
  target: number;
  complete?: boolean;
  fail?: boolean;
  failureReason?: string;
}

export interface BattleObjectiveHandler {
  evaluate(
    definition: BattleObjectiveDefinition,
    runtime: BattleObjectiveRuntimeState,
    context: ObjectiveContext,
  ): ObjectiveEvaluation;
}

type HandlerFactory = () => BattleObjectiveHandler;

export class BattleObjectiveRegistry {
  private readonly factories = new Map<BattleObjectiveType, HandlerFactory>();

  register(type: BattleObjectiveType, factory: HandlerFactory): void {
    if (this.factories.has(type)) throw new Error(`Objective type already registered: ${type}`);
    this.factories.set(type, factory);
  }

  create(type: BattleObjectiveType): BattleObjectiveHandler {
    const factory = this.factories.get(type);
    if (!factory) throw new Error(`Unsupported battle objective type: ${type}`);
    return factory();
  }

  has(type: BattleObjectiveType): boolean {
    return this.factories.has(type);
  }
}

const targetId = (definition: BattleObjectiveDefinition): string | undefined => {
  const target = definition.target;
  return target?.gateId ?? target?.wallId ?? target?.towerId ?? target?.keepId ?? target?.unitId ?? target?.entityId ?? target?.positionId;
};

const numberConfig = (definition: BattleObjectiveDefinition, key: string, fallback: number): number => {
  const value = definition.configuration?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const factionConfig = (definition: BattleObjectiveDefinition, key: string, fallback: string): string => {
  const value = definition.configuration?.[key];
  return typeof value === 'string' ? value : fallback;
};

const findUnit = (context: ObjectiveContext, id?: string) => context.units.find((unit) => unit.id === id);
const findWall = (context: ObjectiveContext, id?: string) => context.walls.find((wall) => wall.id === id);
const findBuilding = (context: ObjectiveContext, id?: string) => context.buildings.find((building) => building.id === id);
const findPosition = (context: ObjectiveContext, id?: string) => context.positions.find((position) => position.id === id);

const destroyBuildingHandler = (): BattleObjectiveHandler => ({
  evaluate: (definition, _runtime, context) => {
    const building = findBuilding(context, targetId(definition));
    if (!building) return { progress: 0, target: 1 };
    return { progress: building.destroyed ? 1 : 0, target: 1, complete: building.destroyed };
  },
});

const captureHandler = (): BattleObjectiveHandler => ({
  evaluate: (definition, _runtime, context) => {
    if (definition.configuration?.useBattleCaptureProgress === true) {
      return { progress: context.captureProgress, target: 1, complete: context.captureProgress >= 1 };
    }
    const building = findBuilding(context, targetId(definition));
    const owner = building?.controlledBy ?? building?.ownerFaction;
    const required = definition.ownerFaction ?? factionConfig(definition, 'faction', 'attacker');
    return { progress: owner === required ? 1 : 0, target: 1, complete: owner === required };
  },
});

const breachWallHandler = (): BattleObjectiveHandler => ({
  evaluate: (definition, _runtime, context) => {
    const wall = findWall(context, targetId(definition));
    return { progress: wall?.breached ? 1 : 0, target: 1, complete: wall?.breached === true };
  },
});

const protectUnitHandler = (): BattleObjectiveHandler => ({
  evaluate: (definition, _runtime, context) => {
    const unit = findUnit(context, targetId(definition));
    if (!unit) return { progress: 0, target: 1, fail: true, failureReason: 'Target unit is unavailable.' };
    const minimum = numberConfig(definition, 'minimumHealthRatio', 0);
    const ratio = unit.maxHealth > 0 ? unit.health / unit.maxHealth : 0;
    if (unit.state === 'dead' || ratio < minimum) {
      return { progress: Math.max(0, ratio), target: 1, fail: true, failureReason: 'Protected commander was lost.' };
    }
    return { progress: Math.min(1, ratio), target: 1 };
  },
});

const holdPositionHandler = (): BattleObjectiveHandler => ({
  evaluate: (definition, runtime, context) => {
    const required = Math.max(0.001, numberConfig(definition, 'requiredSeconds', 1));
    const faction = definition.ownerFaction ?? factionConfig(definition, 'faction', 'attacker');
    const position = findPosition(context, targetId(definition));
    const controlled = position?.controlledBy === faction;
    const lost = definition.configuration?.onControlLost === 'reset';
    let progress = runtime.currentProgress;
    if (controlled) progress += context.deltaSeconds;
    else if (lost) progress = 0;
    progress = Math.min(required, Math.max(0, progress));
    return { progress, target: required, complete: progress >= required };
  },
});

const escortHandler = (): BattleObjectiveHandler => ({
  evaluate: (definition, _runtime, context) => {
    const unit = findUnit(context, targetId(definition));
    if (!unit) return { progress: 0, target: 1, fail: true, failureReason: 'Escort target was destroyed or unavailable.' };
    const destinationId = definition.configuration?.destinationId;
    const destination = typeof destinationId === 'string' ? findPosition(context, destinationId) : undefined;
    const radius = numberConfig(definition, 'radius', 2);
    const reached = destination
      ? Math.hypot(unit.x - destination.x, unit.z - destination.z) <= radius
      : false;
    if (unit.state === 'dead' && definition.configuration?.allowReplacement !== true) {
      return { progress: 0, target: 1, fail: true, failureReason: 'Escorted siege weapon was destroyed.' };
    }
    return { progress: reached ? 1 : 0, target: 1, complete: reached };
  },
});

const destroyCountHandler = (): BattleObjectiveHandler => ({
  evaluate: (definition, runtime, context) => {
    const required = Math.max(1, Math.floor(numberConfig(definition, 'requiredCount', 1)));
    const faction = factionConfig(definition, 'faction', 'defender');
    const targetIds = Array.isArray(definition.configuration?.targetIds)
      ? definition.configuration.targetIds.filter((value): value is string => typeof value === 'string')
      : undefined;
    const aliveOrDead = context.units.filter((unit) => {
      if (targetIds && !targetIds.includes(unit.id)) return false;
      if (unit.faction !== faction) return false;
      const targetType = definition.configuration?.targetType;
      if (typeof targetType === 'string' && unit.unitType !== targetType) return false;
      return unit.state === 'dead';
    }).length;
    const progress = Math.min(required, Math.max(runtime.currentProgress, aliveOrDead));
    return { progress, target: required, complete: progress >= required };
  },
});

const surviveHandler = (): BattleObjectiveHandler => ({
  evaluate: (definition, _runtime, context) => {
    const required = Math.max(0.001, numberConfig(definition, 'requiredSeconds', 1));
    return { progress: Math.min(required, context.battleTime), target: required, complete: context.battleTime >= required };
  },
});

const protectBuildingHandler = (): BattleObjectiveHandler => ({
  evaluate: (definition, _runtime, context) => {
    const building = findBuilding(context, targetId(definition));
    if (!building) return { progress: 0, target: 1, fail: true, failureReason: 'Protected structure is unavailable.' };
    const minimum = numberConfig(definition, 'minimumHealthRatio', 0);
    const ratio = building.maxHealth && building.maxHealth > 0 && typeof building.health === 'number'
      ? building.health / building.maxHealth
      : building.destroyed ? 0 : 1;
    return {
      progress: Math.max(0, Math.min(1, ratio)),
      target: 1,
      fail: building.destroyed === true || ratio < minimum,
      failureReason: building.destroyed ? 'Protected structure was destroyed.' : 'Protected structure fell below its required health.',
    };
  },
});

const eliminateArmyHandler = (): BattleObjectiveHandler => ({
  evaluate: (definition, runtime, context) => {
    const faction = factionConfig(definition, 'faction', 'defender');
    const targets = context.units.filter((unit) => unit.faction === faction);
    const requiredRaw = definition.configuration?.requiredCount;
    const required = requiredRaw === 'all'
      ? targets.length
      : Math.max(1, Math.floor(typeof requiredRaw === 'number' ? requiredRaw : targets.length));
    const dead = targets.filter((unit) => unit.state === 'dead').length;
    const progress = Math.min(required, Math.max(runtime.currentProgress, dead));
    return { progress, target: required, complete: targets.length > 0 && progress >= required };
  },
});

const reachCastleHandler = (): BattleObjectiveHandler => ({
  evaluate: (definition, _runtime, context) => {
    const unit = findUnit(context, targetId(definition));
    const destinationId = definition.configuration?.destinationId;
    const destination = typeof destinationId === 'string' ? findPosition(context, destinationId) : undefined;
    const radius = numberConfig(definition, 'radius', 5);
    const reached = unit && destination
      ? Math.hypot(unit.x - destination.x, unit.z - destination.z) <= radius
      : false;
    return { progress: reached ? 1 : 0, target: 1, complete: reached };
  },
});

const commanderHandler = (): BattleObjectiveHandler => ({
  evaluate: (definition, _runtime, context) => {
    const unit = findUnit(context, targetId(definition));
    return { progress: unit?.state === 'dead' ? 1 : 0, target: 1, complete: unit?.state === 'dead' };
  },
});

export function createDefaultBattleObjectiveRegistry(): BattleObjectiveRegistry {
  const registry = new BattleObjectiveRegistry();
  registry.register('destroy_gate', destroyBuildingHandler);
  registry.register('capture_tower', captureHandler);
  registry.register('breach_wall', breachWallHandler);
  registry.register('protect_commander', protectUnitHandler);
  registry.register('hold_position', holdPositionHandler);
  registry.register('escort_siege_weapon', escortHandler);
  registry.register('destroy_enemy_siege_equipment', destroyCountHandler);
  registry.register('capture_keep', captureHandler);
  registry.register('survive', surviveHandler);
  registry.register('defeat_enemy_commander', commanderHandler);
  registry.register('protect_gate', protectBuildingHandler);
  registry.register('protect_wall', protectBuildingHandler);
  registry.register('eliminate_army', eliminateArmyHandler);
  registry.register('reach_castle', reachCastleHandler);
  registry.register('destroy_siege_camp', destroyBuildingHandler);
  return registry;
}
