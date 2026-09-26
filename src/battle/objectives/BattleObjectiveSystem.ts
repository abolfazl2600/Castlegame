import { BattleObjectiveEventBus } from './BattleObjectiveEvents';
import { BattleObjectiveUI } from './BattleObjectiveUI';
import { createDefaultBattleObjectiveRegistry, type BattleObjectiveHandler } from './BattleObjectiveRegistry';
import type {
  BattleObjectiveDefinition,
  BattleObjectiveRuntimeState,
  BattleScenario,
  ObjectiveContext,
  BattleObjectiveEvent,
  ObjectiveVictoryMode,
} from './BattleObjectiveTypes';
import { DEFAULT_BATTLE_SCENARIO } from './BattleObjectiveDefinitions';

interface RuntimeEntry {
  definition: BattleObjectiveDefinition;
  runtime: BattleObjectiveRuntimeState;
  handler: BattleObjectiveHandler;
}

export interface BattleObjectiveSnapshot {
  definitions: BattleObjectiveDefinition[];
  runtime: BattleObjectiveRuntimeState[];
}

export class BattleObjectiveSystem {
  private readonly registry = createDefaultBattleObjectiveRegistry();
  private readonly eventBus: BattleObjectiveEventBus = new BattleObjectiveEventBus();
  private readonly entries = new Map<string, RuntimeEntry>();
  private readonly order: string[] = [];
  private readonly ui = new BattleObjectiveUI(() => this.getEntries());
  private running = false;
  private battleFinished = false;
  private victoryMode: ObjectiveVictoryMode = 'any_primary';
  private lastContext: ObjectiveContext | null = null;

  start(scenario: BattleScenario = DEFAULT_BATTLE_SCENARIO, battleTime = 0): void {
    this.reset();
    this.validateScenario(scenario);
    this.victoryMode = scenario.victory?.mode ?? 'any_primary';

    const definitions = [...scenario.primaryObjectives, ...(scenario.secondaryObjectives ?? [])];
    for (const definition of definitions) {
      const runtime: BattleObjectiveRuntimeState = {
        id: definition.id,
        status: definition.prerequisites?.length ? 'locked' : 'active',
        currentProgress: 0,
        targetProgress: 1,
        progressRatio: 0,
        ...(definition.prerequisites?.length ? {} : { activatedAt: battleTime }),
      };
      this.entries.set(definition.id, {
        definition,
        runtime,
        handler: this.registry.create(definition.type),
      });
      this.order.push(definition.id);
    }

    this.running = true;
    this.battleFinished = false;
    this.ui.mount();
    this.ui.render();
  }

  reset(): void {
    this.running = false;
    this.battleFinished = false;
    this.entries.clear();
    this.order.length = 0;
    this.lastContext = null;
    this.ui.unmount();
  }

  stop(): void {
    this.running = false;
    this.battleFinished = true;
    this.ui.render();
  }

  update(context: ObjectiveContext): void {
    if (!this.running || this.battleFinished) return;
    this.lastContext = context;

    this.unlockReadyObjectives(context.battleTime);

    for (const id of this.order) {
      const entry = this.entries.get(id);
      if (!entry || entry.runtime.status !== 'active') continue;

      const evaluation = entry.handler.evaluate(entry.definition, entry.runtime, context);
      entry.runtime.targetProgress = Math.max(0, evaluation.target);
      entry.runtime.currentProgress = Math.min(
        entry.runtime.targetProgress,
        Math.max(0, evaluation.progress),
      );
      entry.runtime.progressRatio = entry.runtime.targetProgress > 0
        ? Math.min(1, entry.runtime.currentProgress / entry.runtime.targetProgress)
        : 0;

      if (evaluation.fail === true) {
        this.fail(entry, evaluation.failureReason ?? 'Objective failed.');
      } else if (evaluation.complete === true) {
        this.complete(entry, context.battleTime);
      }
    }

    this.ui.render();
  }

  activateDynamicObjective(definition: BattleObjectiveDefinition, battleTime?: number): void {
    if (!this.running || this.battleFinished) return;
    if (this.entries.has(definition.id)) throw new Error(`Objective already exists: ${definition.id}`);
    this.validateDefinition(definition, new Set(this.order));

    const runtime: BattleObjectiveRuntimeState = {
      id: definition.id,
      status: definition.prerequisites?.length ? 'locked' : 'active',
      currentProgress: 0,
      targetProgress: 1,
      progressRatio: 0,
      ...(definition.prerequisites?.length ? {} : { activatedAt: battleTime ?? this.lastContext?.battleTime ?? 0 }),
    };
    this.entries.set(definition.id, {
      definition,
      runtime,
      handler: this.registry.create(definition.type),
    });
    this.order.push(definition.id);
    this.ui.render();
  }

  emit(event: BattleObjectiveEvent): void {
    if (!this.running || this.battleFinished) return;
    this.eventBus.emit(event);
  }

  subscribe(listener: (event: BattleObjectiveEvent) => void): () => void {
    return this.eventBus.subscribe(listener);
  }

  isVictorySatisfied(): boolean {
    const primary = this.getPrimaryEntries();
    if (primary.length === 0) return false;
    return this.victoryMode === 'all_primary'
      ? primary.every(({ runtime }) => runtime.status === 'completed')
      : primary.some(({ runtime }) => runtime.status === 'completed');
  }

  hasFailedPrimaryObjective(): boolean {
    return this.getPrimaryEntries().some(({ runtime }) => runtime.status === 'failed');
  }

  getEntries(): RuntimeEntry[] {
    return this.order
      .map((id) => this.entries.get(id))
      .filter((entry): entry is RuntimeEntry => Boolean(entry));
  }

  getObjectiveState(): BattleObjectiveSnapshot {
    return this.getState();
  }

  activateDynamicObjectiveDefinition(definition: BattleObjectiveDefinition, battleTime?: number): void {
    this.activateDynamicObjective(definition, battleTime);
  }

  getState(): BattleObjectiveSnapshot {
    return {
      definitions: this.getEntries().map((entry) => entry.definition),
      runtime: this.getEntries().map((entry) => ({ ...entry.runtime })),
    };
  }

  serialize(): BattleObjectiveSnapshot {
    return this.getState();
  }

  restore(snapshot: BattleObjectiveSnapshot, battleTime = 0): void {
    this.reset();
    const primary = snapshot.definitions.filter((definition) => definition.priority === 'primary');
    const secondary = snapshot.definitions.filter((definition) => definition.priority === 'secondary');
    this.start({ id: 'restored-battle', primaryObjectives: primary, secondaryObjectives: secondary }, battleTime);
    for (const saved of snapshot.runtime) {
      const entry = this.entries.get(saved.id);
      if (!entry) continue;
      entry.runtime = { ...saved };
    }
    this.ui.render();
  }

  private unlockReadyObjectives(battleTime: number): void {
    for (const entry of this.getEntries()) {
      if (entry.runtime.status !== 'locked') continue;
      const prerequisites = entry.definition.prerequisites ?? [];
      if (prerequisites.every((id) => this.entries.get(id)?.runtime.status === 'completed')) {
        entry.runtime.status = 'active';
        entry.runtime.activatedAt = battleTime;
      }
    }
  }

  private complete(entry: RuntimeEntry, battleTime: number): void {
    if (entry.runtime.status !== 'active') return;
    entry.runtime.status = 'completed';
    entry.runtime.currentProgress = entry.runtime.targetProgress;
    entry.runtime.progressRatio = 1;
    entry.runtime.completedAt = battleTime;
    this.emit({ type: this.eventTypeFor(entry.definition), entityId: this.entityIdFor(entry.definition) });
  }

  private fail(entry: RuntimeEntry, reason: string): void {
    if (entry.runtime.status !== 'active') return;
    entry.runtime.status = 'failed';
    entry.runtime.failedAt = this.lastContext?.battleTime;
    entry.runtime.failureReason = reason;
  }

  private getPrimaryEntries(): RuntimeEntry[] {
    return this.getEntries().filter((entry) => entry.definition.priority === 'primary');
  }

  private eventTypeFor(definition: BattleObjectiveDefinition): BattleObjectiveEvent['type'] {
    switch (definition.type) {
      case 'destroy_gate':
      case 'protect_gate': return 'GATE_DESTROYED';
      case 'breach_wall':
      case 'protect_wall': return 'WALL_BREACHED';
      case 'capture_tower': return 'TOWER_CAPTURED';
      case 'capture_keep': return 'KEEP_CAPTURED';
      case 'defeat_enemy_commander':
      case 'protect_commander': return 'COMMANDER_KILLED';
      case 'escort_siege_weapon': return 'SIEGE_WEAPON_REACHED_DESTINATION';
      case 'destroy_enemy_siege_equipment': return 'SIEGE_WEAPON_DESTROYED';
      case 'reach_castle': return 'UNIT_REACHED_LOCATION';
      default: return 'BATTLE_TIME_UPDATED';
    }
  }

  private entityIdFor(definition: BattleObjectiveDefinition): string | undefined {
    const target = definition.target;
    return target?.gateId ?? target?.wallId ?? target?.towerId ?? target?.keepId ?? target?.unitId ?? target?.entityId ?? target?.positionId;
  }

  private validateScenario(scenario: BattleScenario): void {
    const definitions = [...scenario.primaryObjectives, ...(scenario.secondaryObjectives ?? [])];
    const ids = new Set<string>();
    for (const definition of definitions) {
      if (ids.has(definition.id)) throw new Error(`Duplicate objective id: ${definition.id}`);
      ids.add(definition.id);
    }
    for (const definition of definitions) this.validateDefinition(definition, ids);

    const visiting = new Set<string>();
    const visited = new Set<string>();
    const byId = new Map(definitions.map((definition) => [definition.id, definition]));
    const visit = (id: string): void => {
      if (visiting.has(id)) throw new Error(`Circular objective dependency involving: ${id}`);
      if (visited.has(id)) return;
      visiting.add(id);
      for (const dependency of byId.get(id)?.prerequisites ?? []) visit(dependency);
      visiting.delete(id);
      visited.add(id);
    };
    for (const definition of definitions) visit(definition.id);
  }

  private validateDefinition(definition: BattleObjectiveDefinition, knownIds: Set<string>): void {
    if (!definition.id.trim()) throw new Error('Objective id cannot be empty.');
    if (!this.registry.has(definition.type)) throw new Error(`Unsupported objective type: ${definition.type}`);
    for (const prerequisite of definition.prerequisites ?? []) {
      if (!knownIds.has(prerequisite) && !this.entries.has(prerequisite)) {
        throw new Error(`Missing objective prerequisite: ${prerequisite}`);
      }
    }
  }
}
