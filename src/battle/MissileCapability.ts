import type { GameMode } from '../core/GameMode';
import type { MissileInventoryState } from '../core/types';
import type { MilitaryTier } from './MilitaryProgression';

export const MISSILE_CONFIG = {
  unlockTier: 4 as MilitaryTier,
  maxStock: 3,
  productionMs: 10_000,
  supplyCost: 2,
  maxSupply: 6,
  supplyRechargeMs: 30_000,
  cooldownMs: 12_000,
  range: 56,
  impactRadius: 7.5,
  damage: 170,
} as const;

export interface MissileProductionResult {
  readonly ok: boolean;
  readonly state: MissileInventoryState;
  readonly message: string;
}

export interface MissileTickResult {
  readonly state: MissileInventoryState;
  readonly produced: boolean;
  readonly supplyRestored: boolean;
  readonly cooldownReady: boolean;
}

export function defaultMissileState(): MissileInventoryState {
  return {
    stock: 0,
    productionRemainingMs: 0,
    cooldownRemainingMs: 0,
    supply: MISSILE_CONFIG.maxSupply,
    supplyRechargeRemainingMs: MISSILE_CONFIG.supplyRechargeMs,
  };
}

export function normalizeMissileState(value?: Partial<MissileInventoryState> | null): MissileInventoryState {
  const base = defaultMissileState();
  const clamp = (input: unknown, min: number, max: number, fallback: number): number => {
    const numeric = Number(input);
    return Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : fallback;
  };

  return {
    stock: Math.floor(clamp(value?.stock, 0, MISSILE_CONFIG.maxStock, base.stock)),
    productionRemainingMs: clamp(value?.productionRemainingMs, 0, MISSILE_CONFIG.productionMs, base.productionRemainingMs),
    cooldownRemainingMs: clamp(value?.cooldownRemainingMs, 0, MISSILE_CONFIG.cooldownMs, base.cooldownRemainingMs),
    supply: Math.floor(clamp(value?.supply, 0, MISSILE_CONFIG.maxSupply, base.supply)),
    supplyRechargeRemainingMs: clamp(
      value?.supplyRechargeRemainingMs,
      0,
      MISSILE_CONFIG.supplyRechargeMs,
      base.supplyRechargeRemainingMs,
    ),
  };
}

export function missileModeAvailable(mode: GameMode): boolean {
  return mode === 'sandbox';
}

export function missilesUnlocked(mode: GameMode, _tier: MilitaryTier): boolean {
  return mode === 'sandbox';
}

export function beginMissileProduction(
  state: MissileInventoryState,
  mode: GameMode,
  tier: MilitaryTier,
  battleActive: boolean,
): MissileProductionResult {
  const current = normalizeMissileState(state);

  if (!missileModeAvailable(mode)) {
    return { ok: false, state: current, message: 'Missile production is available in Sandbox mode only' };
  }
  if (!missilesUnlocked(mode, tier)) {
    return { ok: false, state: current, message: `Missiles unlock at Military Tier ${MISSILE_CONFIG.unlockTier}` };
  }
  if (battleActive) {
    return { ok: false, state: current, message: 'Missile production is unavailable during an active battle' };
  }
  if (current.productionRemainingMs > 0) {
    return { ok: false, state: current, message: 'A missile is already in production' };
  }
  if (current.stock >= MISSILE_CONFIG.maxStock) {
    return { ok: false, state: current, message: 'Missile stock is full' };
  }
  if (current.supply < MISSILE_CONFIG.supplyCost) {
    return {
      ok: false,
      state: current,
      message: `Need ${MISSILE_CONFIG.supplyCost} ordnance supply to produce a missile`,
    };
  }

  return {
    ok: true,
    state: {
      ...current,
      supply: current.supply - MISSILE_CONFIG.supplyCost,
      productionRemainingMs: MISSILE_CONFIG.productionMs,
    },
    message: `Missile production started · cost ${MISSILE_CONFIG.supplyCost} supply`,
  };
}

export function tickMissileState(
  state: MissileInventoryState,
  deltaMs: number,
  available: boolean,
  productionEnabled: boolean,
  timersEnabled: boolean,
): MissileTickResult {
  const current = normalizeMissileState(state);
  if (!available || !timersEnabled || !Number.isFinite(deltaMs) || deltaMs <= 0) {
    return { state: current, produced: false, supplyRestored: false, cooldownReady: false };
  }

  const delta = Math.max(0, deltaMs);
  let produced = false;
  let supplyRestored = false;
  const cooldownWasActive = current.cooldownRemainingMs > 0;

  let cooldownRemainingMs = Math.max(0, current.cooldownRemainingMs - delta);
  let productionRemainingMs = current.productionRemainingMs;
  let stock = current.stock;
  let supply = current.supply;
  let supplyRechargeRemainingMs = current.supplyRechargeRemainingMs;

  if (productionEnabled && productionRemainingMs > 0) {
    productionRemainingMs = Math.max(0, productionRemainingMs - delta);
    if (productionRemainingMs === 0 && stock < MISSILE_CONFIG.maxStock) {
      stock += 1;
      produced = true;
    }
  }

  if (supply < MISSILE_CONFIG.maxSupply) {
    supplyRechargeRemainingMs = Math.max(0, supplyRechargeRemainingMs - delta);
    if (supplyRechargeRemainingMs === 0) {
      supply += 1;
      supplyRestored = true;
      supplyRechargeRemainingMs = MISSILE_CONFIG.supplyRechargeMs;
    }
  } else {
    supplyRechargeRemainingMs = MISSILE_CONFIG.supplyRechargeMs;
  }

  return {
    state: {
      stock,
      productionRemainingMs,
      cooldownRemainingMs,
      supply,
      supplyRechargeRemainingMs,
    },
    produced,
    supplyRestored,
    cooldownReady: cooldownWasActive && cooldownRemainingMs === 0,
  };
}
