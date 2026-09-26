import { GameState } from '../state/GameState';
import { KeepSystem } from '../building/KeepSystem';
import { WallCornerSystem } from '../building/WallCornerSystem';
import { CastleAccessSystem } from '../building/CastleAccessSystem';
import { GateSystem } from '../building/GateSystem';
import { DestructibleBuildingSystem } from '../building/DestructibleBuildingSystem';
import { CastleDetailGenerator } from '../building/CastleDetailGenerator';
import { PopulationSystem } from '../systems/PopulationSystem';
import { WindmillSystem } from '../systems/WindmillSystem';
import { OrchardSystem } from '../systems/OrchardSystem';

export interface GameDomainServices {
  readonly state: GameState;
  readonly keepSystem: KeepSystem;
  readonly wallCornerSystem: WallCornerSystem;
  readonly castleAccessSystem: CastleAccessSystem;
  readonly gateSystem: GateSystem;
  readonly destructibleBuildingSystem: DestructibleBuildingSystem;
  readonly populationSystem: PopulationSystem;
  readonly windmillSystem: WindmillSystem;
  readonly orchardSystem: OrchardSystem;
  readonly detailGenerator: CastleDetailGenerator;
}

export function createGameDomainServices(): GameDomainServices {
  return {
    state: new GameState(),
    keepSystem: new KeepSystem(),
    wallCornerSystem: new WallCornerSystem(),
    castleAccessSystem: new CastleAccessSystem(),
    gateSystem: new GateSystem(),
    destructibleBuildingSystem: new DestructibleBuildingSystem(),
    populationSystem: new PopulationSystem(),
    windmillSystem: new WindmillSystem(),
    orchardSystem: new OrchardSystem(),
    detailGenerator: new CastleDetailGenerator(),
  };
}
