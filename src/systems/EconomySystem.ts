import type { ToolKind } from '../core/types';
import type { EconomyResourceState } from '../core/types';
import type { CellEntry } from '../state/GameState';
import { carpenterLevelDefinition, normalizeCarpenterLevel } from '../building/CarpenterWorkshopProgression';

export type EconomyResourceKey = keyof EconomyResourceState;

export interface EconomyRates {
  logsPerSecond: number;
  woodPerSecond: number;
  stonePerSecond: number;
  grainPerSecond: number;
  applesPerSecond: number;
  flourPerSecond: number;
  foodPerSecond: number;
  foodConsumptionPerSecond: number;
}

export interface EconomySnapshot {
  resources: EconomyResourceState;
  rates: EconomyRates;
  storageCapacity: number;
  foodAvailable: number;
  foodShortage: boolean;
}

export interface EconomyTickResult {
  updated: boolean;
  shortageChanged: boolean;
  shortage: boolean;
}

export interface ResourceCost {
  wood?: number;
  stone?: number;
}

const TICK_MS = 1000;

const DEFAULT_RESOURCES: EconomyResourceState = {
  logs: 24,
  wood: 120,
  stone: 120,
  grain: 35,
  apples: 18,
  flour: 0,
  food: 30,
};

const CONSTRUCTION_COSTS: Partial<Record<ToolKind, ResourceCost>> = {
  wall1: { stone: 2 },
  wall2: { wood: 2 },
  wall3: { stone: 4, wood: 1 },
  gate: { wood: 5, stone: 3 },
  tower: { stone: 10, wood: 4 },
  towerBridge: { stone: 6, wood: 6 },
  keep: { stone: 20, wood: 10 },
  road: { wood: 1 },
  dirtRoad: { wood: 1 },
  stoneRoad: { stone: 1 },
  cottage: { wood: 4, stone: 1 },
  house: { wood: 6, stone: 2 },
  manor: { wood: 10, stone: 6 },
  villa: { wood: 9, stone: 4 },
  farm: { wood: 3 },
  cowBarn: { wood: 6, stone: 2 },
  appleOrchard: { wood: 3 },
  windmill: { wood: 7, stone: 5 },
  mine: { wood: 4, stone: 2 },
  carpenter: { wood: 6, stone: 2 },
  market: { wood: 6, stone: 4 },
  basilica: { wood: 8, stone: 14 },
  armyCamp: { wood: 8, stone: 2 },
  hut: { wood: 2 },
  harbor: { wood: 6 },
  stoneStairs: { stone: 4 },
  woodenStairs: { wood: 4 },
  ramp: { wood: 3 },
  ladder: { wood: 2 },
};

function finiteNonNegative(value: unknown, fallback = 0): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, number);
}

function scaledLevel(cell: CellEntry, max = 4): number {
  return Math.max(1, Math.min(max, Math.floor(cell.level ?? 1)));
}

function cloneState(state: EconomyResourceState): EconomyResourceState {
  return { ...state };
}

export class EconomySystem {
  private resources: EconomyResourceState = cloneState(DEFAULT_RESOURCES);
  private rates: EconomyRates = {
    logsPerSecond: 0,
    woodPerSecond: 0,
    stonePerSecond: 0,
    grainPerSecond: 0,
    applesPerSecond: 0,
    flourPerSecond: 0,
    foodPerSecond: 0,
    foodConsumptionPerSecond: 0,
  };
  private accumulatorMs = 0;
  private shortage = false;

  reset(): void {
    this.resources = cloneState(DEFAULT_RESOURCES);
    this.rates = {
      logsPerSecond: 0,
      woodPerSecond: 0,
      stonePerSecond: 0,
      grainPerSecond: 0,
      applesPerSecond: 0,
      flourPerSecond: 0,
      foodPerSecond: 0,
      foodConsumptionPerSecond: 0,
    };
    this.accumulatorMs = 0;
    this.shortage = false;
  }

  getState(): EconomyResourceState {
    return cloneState(this.resources);
  }

  setState(value?: Partial<EconomyResourceState> | null): void {
    const source = value ?? DEFAULT_RESOURCES;
    this.resources = {
      logs: finiteNonNegative(source.logs, DEFAULT_RESOURCES.logs),
      wood: finiteNonNegative(source.wood, DEFAULT_RESOURCES.wood),
      stone: finiteNonNegative(source.stone, DEFAULT_RESOURCES.stone),
      grain: finiteNonNegative(source.grain, DEFAULT_RESOURCES.grain),
      apples: finiteNonNegative(source.apples, DEFAULT_RESOURCES.apples),
      flour: finiteNonNegative(source.flour, DEFAULT_RESOURCES.flour),
      food: finiteNonNegative(source.food, DEFAULT_RESOURCES.food),
    };
    this.accumulatorMs = 0;
    this.shortage = false;
  }

  storageCapacity(cells: CellEntry[], keepCount: number): number {
    let capacity = 220 + Math.max(0, keepCount) * 180;
    for (const cell of cells) {
      if (cell.kind === 'market') capacity += 90;
      else if (cell.kind === 'manor' || (cell.kind === 'cottage' && scaledLevel(cell) >= 3)) capacity += 45;
      else if (cell.kind === 'farm') capacity += 15 * scaledLevel(cell);
      else if (cell.kind === 'cowBarn') capacity += 12 * scaledLevel(cell);
      else if (cell.kind === 'carpenter') capacity += 18 * normalizeCarpenterLevel(cell.level);
    }
    return Math.max(220, Math.round(capacity));
  }

  snapshot(cells: CellEntry[], civilianPopulation: number, keepCount: number): EconomySnapshot {
    return {
      resources: this.getState(),
      rates: { ...this.rates },
      storageCapacity: this.storageCapacity(cells, keepCount),
      foodAvailable: this.resources.food + this.resources.flour + this.resources.apples + this.resources.grain,
      foodShortage: this.shortage && civilianPopulation > 0,
    };
  }

  constructionCost(tool: ToolKind, quantity = 1): ResourceCost {
    const base = CONSTRUCTION_COSTS[tool] ?? {};
    const multiplier = Math.max(0, quantity);
    return {
      wood: Math.max(0, (base.wood ?? 0) * multiplier),
      stone: Math.max(0, (base.stone ?? 0) * multiplier),
    };
  }

  canAfford(cost: ResourceCost): boolean {
    return this.resources.wood + 1e-9 >= (cost.wood ?? 0) &&
      this.resources.stone + 1e-9 >= (cost.stone ?? 0);
  }

  missing(cost: ResourceCost): ResourceCost {
    return {
      wood: Math.max(0, (cost.wood ?? 0) - this.resources.wood),
      stone: Math.max(0, (cost.stone ?? 0) - this.resources.stone),
    };
  }

  spend(cost: ResourceCost): boolean {
    if (!this.canAfford(cost)) return false;
    this.resources.wood = Math.max(0, this.resources.wood - (cost.wood ?? 0));
    this.resources.stone = Math.max(0, this.resources.stone - (cost.stone ?? 0));
    return true;
  }

  tick(
    deltaMs: number,
    cells: CellEntry[],
    civilianPopulation: number,
    keepCount: number,
  ): EconomyTickResult {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
      return { updated: false, shortageChanged: false, shortage: this.shortage };
    }

    this.accumulatorMs += Math.min(deltaMs, 5000);
    let updated = false;
    const previousShortage = this.shortage;

    while (this.accumulatorMs >= TICK_MS) {
      this.accumulatorMs -= TICK_MS;
      this.step(cells, civilianPopulation, keepCount);
      updated = true;
    }

    return {
      updated,
      shortageChanged: previousShortage !== this.shortage,
      shortage: this.shortage,
    };
  }

  private step(cells: CellEntry[], civilianPopulation: number, keepCount: number): void {
    let logRate = 0;
    let woodRate = 0;
    let stoneRate = 0;
    let grainRate = 0;
    let appleRate = 0;
    let directFoodRate = 0;
    let windmillCapacity = 0;
    let bakeryCapacity = 0;

    for (const cell of cells) {
      const level = scaledLevel(cell);
      if (cell.kind === 'farm') grainRate += 0.58 * (1 + (level - 1) * 0.32);
      else if (cell.kind === 'appleOrchard') appleRate += 0.32 * scaledLevel(cell, 3);
      else if (cell.kind === 'cowBarn') directFoodRate += 0.18 * (1 + (level - 1) * 0.25);
      else if (cell.kind === 'windmill') windmillCapacity += 0.48 * level;
      else if (cell.kind === 'market') bakeryCapacity += 0.32;
      else if (cell.kind === 'mine') stoneRate += 0.24 * level;
      else if (cell.kind === 'hut') logRate += 0.18 * level;
      else if (cell.kind === 'tree') logRate += 0.025 * level;
    }

    const capacity = this.storageCapacity(cells, keepCount);

    this.resources.logs = Math.min(capacity, this.resources.logs + logRate);

    let logsProcessed = 0;
    let woodProduced = 0;
    for (const cell of cells) {
      if (cell.kind !== 'carpenter') continue;
      const definition = carpenterLevelDefinition(cell.level);
      const input = Math.min(this.resources.logs, definition.inputPerSecond);
      this.resources.logs -= input;
      logsProcessed += input;
      woodProduced += input * definition.yieldRatio;
    }
    woodRate += woodProduced;
    this.resources.wood = Math.min(capacity, this.resources.wood + woodProduced);
    this.resources.stone = Math.min(capacity, this.resources.stone + stoneRate);
    this.resources.grain = Math.min(capacity, this.resources.grain + grainRate);
    this.resources.apples = Math.min(capacity, this.resources.apples + appleRate);
    this.resources.food = Math.min(capacity, this.resources.food + directFoodRate);

    const grainToMill = Math.min(this.resources.grain, windmillCapacity);
    this.resources.grain -= grainToMill;
    const flourProduced = grainToMill * 0.82;
    this.resources.flour = Math.min(capacity, this.resources.flour + flourProduced);

    const flourToBakery = Math.min(this.resources.flour, bakeryCapacity);
    this.resources.flour -= flourToBakery;
    const foodProduced = flourToBakery * 1.15;
    this.resources.food = Math.min(capacity, this.resources.food + foodProduced);

    let remainingDemand = Math.max(0, Math.floor(civilianPopulation)) * 0.012;
    const consume = (key: 'food' | 'apples' | 'flour' | 'grain'): void => {
      if (remainingDemand <= 0) return;
      const amount = Math.min(this.resources[key], remainingDemand);
      this.resources[key] -= amount;
      remainingDemand -= amount;
    };

    consume('food');
    consume('apples');
    consume('flour');
    consume('grain');

    this.shortage = remainingDemand > 0.0001;
    this.rates = {
      logsPerSecond: logRate - logsProcessed,
      woodPerSecond: woodRate,
      stonePerSecond: stoneRate,
      grainPerSecond: grainRate - grainToMill,
      applesPerSecond: appleRate,
      flourPerSecond: flourProduced - flourToBakery,
      foodPerSecond: directFoodRate + foodProduced,
      foodConsumptionPerSecond: Math.max(0, Math.floor(civilianPopulation)) * 0.012,
    };
  }
}
