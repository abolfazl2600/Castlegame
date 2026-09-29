import { GameState } from '../state/GameState';
import { KeepSystem } from '../building/KeepSystem';
import { WallCornerSystem } from '../building/WallCornerSystem';
import { GateSystem } from '../building/GateSystem';
import { DestructibleBuildingSystem } from '../building/DestructibleBuildingSystem';
import { CastleDetailGenerator } from '../building/CastleDetailGenerator';
import { PopulationSystem } from '../systems/PopulationSystem';
import { WindmillSystem } from '../systems/WindmillSystem';
import { OrchardSystem } from '../systems/OrchardSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { GameSession } from './GameSession';

export interface GameDomainServices {
  readonly state: GameState;
  readonly keepSystem: KeepSystem;
  readonly wallCornerSystem: WallCornerSystem;
  readonly gateSystem: GateSystem;
  readonly destructibleBuildingSystem: DestructibleBuildingSystem;
  readonly populationSystem: PopulationSystem;
  readonly windmillSystem: WindmillSystem;
  readonly orchardSystem: OrchardSystem;
  readonly economySystem: EconomySystem;
  readonly detailGenerator: CastleDetailGenerator;
  readonly session: GameSession;
}

export function createGameDomainServices(): GameDomainServices {
  const state = new GameState();

  return {
    state,
    keepSystem: new KeepSystem(),
    wallCornerSystem: new WallCornerSystem(),
    gateSystem: new GateSystem(),
    destructibleBuildingSystem: new DestructibleBuildingSystem(),
    populationSystem: new PopulationSystem(),
    windmillSystem: new WindmillSystem(),
    orchardSystem: new OrchardSystem(),
    economySystem: new EconomySystem(),
    detailGenerator: new CastleDetailGenerator(),
    session: new GameSession(state),
  };
}
