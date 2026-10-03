import type {
  CivilianOccupation,
  MilitiaUnitType,
  PopulationGridRef,
  PopulationSimulationState,
  SavedCitizenState,
  SavedProfessionalSoldierState,
} from '../core/types';
import type { CellEntry } from '../state/GameState';

export interface PopulationGroups {
  civilians: number;
  military: number;
  workers: number;
  farmers: number;
  miners: number;
  sailors: number;
  merchants: number;
  available: number;
  builders: number;
  militia: number;
  professionalArmy: number;
  wounded: number;
}

export interface MilitiaComposition {
  swordsman: number;
  archer: number;
  spearman: number;
  crossbowman: number;
}

export interface PopulationRenderAssignment {
  key: string;
  citizenId: string;
  role: 'citizen' | 'farmer' | 'worker';
  home: PopulationGridRef;
  work?: PopulationGridRef;
  seed: number;
}

const RESIDENTIAL_LEVEL_CAPACITY = [0, 18, 30, 42, 42] as const;

function residentialCapacity(cell: Pick<CellEntry, 'kind' | 'level'>): number {
  if (cell.kind === 'hut') return 4;

  // Canonical residential upgrades must never reduce housing capacity.
  // Legacy aliases retain their historical direct-state values for compatibility;
  // SaveSystem migrates real loaded worlds into cottage + level before simulation.
  if (cell.kind === 'cottage') {
    const level = Math.max(1, Math.min(4, Math.floor(cell.level ?? 1)));
    return RESIDENTIAL_LEVEL_CAPACITY[level] ?? 0;
  }
  if (cell.kind === 'house') return 30;
  if (cell.kind === 'manor') return 42;
  if (cell.kind === 'villa') return 36;
  return 0;
}

const ARMY_CAMP_CAPACITY = [0, 6, 12, 20, 32] as const;
const MILITIA_TYPES: MilitiaUnitType[] = ['swordsman', 'archer', 'spearman', 'crossbowman'];
/** Army Camp slots determine a reproducible medieval defender roster. */
const GARRISON_ROLES: readonly MilitiaUnitType[] = ['swordsman', 'spearman', 'archer', 'swordsman', 'crossbowman'];

function clonePoint(point?: PopulationGridRef): PopulationGridRef | undefined {
  return point ? { x: point.x, y: point.y } : undefined;
}

function pointKey(point?: PopulationGridRef): string {
  return point ? `${point.x},${point.y}` : '';
}

function numericId(id: string): number {
  const match = id.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

export class PopulationSystem {
  private state: PopulationSimulationState = {
    nextCitizenId: 1,
    nextSoldierId: 1,
    housingCapacityHighWater: 0,
    citizens: [],
    professionalArmy: [],
  };

  private lastCells: CellEntry[] = [];

  calculate(cells: CellEntry[], _legacyMilitary = 0): PopulationGroups {
    this.reconcile(cells);
    const snapshot = this.snapshot();
    return {
      civilians: snapshot.totalPopulation,
      military: snapshot.militia + snapshot.professionalArmy,
      workers: snapshot.builders + snapshot.productionWorkers,
      farmers: snapshot.farmers,
      miners: snapshot.miners,
      sailors: snapshot.sailors,
      merchants: snapshot.merchants,
      available: snapshot.available,
      builders: snapshot.builders,
      militia: snapshot.militia,
      professionalArmy: snapshot.professionalArmy,
      wounded: 0,
    };
  }

  reconcile(cells: CellEntry[]): void {
    this.lastCells = cells.map((cell) => ({ ...cell }));
    const homes = this.homeCells(cells);
    const currentCapacity = homes.reduce(
      (sum, cell) => sum + residentialCapacity(cell),
      0,
    );

    const previousHighWater = Math.max(0, this.state.housingCapacityHighWater);
    if (currentCapacity > previousHighWater) {
      this.addCitizens(currentCapacity - previousHighWater, homes);
      this.state.housingCapacityHighWater = currentCapacity;
    } else if (this.state.citizens.length === 0 && currentCapacity > 0) {
      this.addCitizens(currentCapacity, homes);
      this.state.housingCapacityHighWater = currentCapacity;
    } else {
      this.state.housingCapacityHighWater = Math.max(previousHighWater, currentCapacity);
    }

    this.reassignMissingHomes(homes);
    this.reassignJobs(cells);
    this.reconcileProfessionalArmyCamps(cells);
  }

  snapshot(): {
    totalPopulation: number;
    available: number;
    farmers: number;
    builders: number;
    productionWorkers: number;
    miners: number;
    sailors: number;
    merchants: number;
    militia: number;
    professionalArmy: number;
    deadCivilians: number;
    deadProfessionalArmy: number;
  } {
    const living = this.state.citizens.filter((citizen) => citizen.alive);
    const countOccupation = (occupation: CivilianOccupation): number =>
      living.filter((citizen) => citizen.occupation === occupation).length;

    const farmers = countOccupation('farmer');
    const builders = countOccupation('builder');
    const miners = countOccupation('miner');
    const sailors = countOccupation('sailor');
    const merchants = countOccupation('merchant');
    const workers = countOccupation('worker');
    const militia = living.filter((citizen) => citizen.militiaType).length;
    const professionalArmy = this.state.professionalArmy.filter((soldier) => soldier.alive).length;

    return {
      totalPopulation: living.length,
      available: countOccupation('idle'),
      farmers,
      builders,
      productionWorkers: workers + miners + sailors + merchants,
      miners,
      sailors,
      merchants,
      militia,
      professionalArmy,
      deadCivilians: this.state.citizens.length - living.length,
      deadProfessionalArmy: this.state.professionalArmy.length - professionalArmy,
    };
  }

  getState(): PopulationSimulationState {
    return {
      nextCitizenId: this.state.nextCitizenId,
      nextSoldierId: this.state.nextSoldierId,
      housingCapacityHighWater: this.state.housingCapacityHighWater,
      citizens: this.state.citizens.map((citizen) => ({
        ...citizen,
        home: clonePoint(citizen.home),
        workplace: clonePoint(citizen.workplace),
        previousWorkplace: clonePoint(citizen.previousWorkplace),
      })),
      professionalArmy: this.state.professionalArmy.map((soldier) => ({
        ...soldier,
        camp: clonePoint(soldier.camp),
      })),
    };
  }

  setState(value?: Partial<PopulationSimulationState> | null): void {
    if (!value) {
      this.state = {
        nextCitizenId: 1,
        nextSoldierId: 1,
        housingCapacityHighWater: 0,
        citizens: [],
        professionalArmy: [],
      };
      return;
    }

    const citizens = Array.isArray(value.citizens)
      ? value.citizens
          .filter((citizen): citizen is SavedCitizenState => Boolean(citizen && typeof citizen.id === 'string'))
          .map((citizen) => ({
            ...citizen,
            alive: citizen.alive !== false,
            occupation: citizen.occupation ?? 'idle',
            home: clonePoint(citizen.home),
            workplace: clonePoint(citizen.workplace),
            previousWorkplace: clonePoint(citizen.previousWorkplace),
            mobilized: citizen.mobilized === true,
          }))
      : [];

    const professionalArmy = Array.isArray(value.professionalArmy)
      ? value.professionalArmy
          .filter((soldier): soldier is SavedProfessionalSoldierState =>
            Boolean(soldier && typeof soldier.id === 'string'))
          .map((soldier) => ({
            ...soldier,
            alive: soldier.alive !== false,
            unitType: soldier.unitType === 'modernSoldier' ? 'swordsman' : soldier.unitType,
            camp: clonePoint(soldier.camp),
          }))
      : [];

    this.state = {
      nextCitizenId: Math.max(
        Number(value.nextCitizenId) || 1,
        citizens.reduce((max, citizen) => Math.max(max, numericId(citizen.id) + 1), 1),
      ),
      nextSoldierId: Math.max(
        Number(value.nextSoldierId) || 1,
        professionalArmy.reduce((max, soldier) => Math.max(max, numericId(soldier.id) + 1), 1),
      ),
      housingCapacityHighWater: Math.max(
        Number(value.housingCapacityHighWater) || 0,
        citizens.filter((citizen) => citizen.alive).length,
      ),
      citizens,
      professionalArmy,
    };
  }

  setMilitiaComposition(requested: Partial<MilitiaComposition>): MilitiaComposition {
    const desired: MilitiaComposition = {
      swordsman: this.normalizeCount(requested.swordsman),
      archer: this.normalizeCount(requested.archer),
      spearman: this.normalizeCount(requested.spearman),
      crossbowman: this.normalizeCount(requested.crossbowman),
    };

    for (const type of MILITIA_TYPES) {
      const assigned = this.state.citizens
        .filter((citizen) => citizen.alive && citizen.militiaType === type)
        .sort((a, b) => numericId(a.id) - numericId(b.id));

      while (assigned.length > desired[type]) {
        const citizen = assigned.pop();
        if (citizen) this.releaseMilitiaCitizen(citizen);
      }
    }

    this.reassignJobs(this.lastCells);

    const priority = (citizen: SavedCitizenState): number => {
      switch (citizen.occupation) {
        case 'idle': return 0;
        case 'builder': return 1;
        case 'worker': return 2;
        case 'merchant': return 3;
        case 'sailor': return 4;
        case 'miner': return 5;
        case 'farmer': return 6;
        default: return 7;
      }
    };

    for (const type of MILITIA_TYPES) {
      let assignedCount = this.state.citizens.filter(
        (citizen) => citizen.alive && citizen.militiaType === type,
      ).length;

      const candidates = this.state.citizens
        .filter((citizen) => citizen.alive && !citizen.militiaType)
        .sort((a, b) => priority(a) - priority(b) || numericId(a.id) - numericId(b.id));

      for (const citizen of candidates) {
        if (assignedCount >= desired[type]) break;
        const previousOccupation =
          citizen.occupation === 'militia' ? 'idle' : citizen.occupation;
        citizen.previousOccupation = previousOccupation;
        citizen.previousWorkplace = clonePoint(citizen.workplace);
        citizen.occupation = 'militia';
        citizen.workplace = undefined;
        citizen.militiaType = type;
        citizen.mobilized = false;
        assignedCount += 1;
      }
    }

    this.reassignJobs(this.lastCells);
    return this.militiaComposition();
  }

  militiaComposition(): MilitiaComposition {
    const result: MilitiaComposition = {
      swordsman: 0,
      archer: 0,
      spearman: 0,
      crossbowman: 0,
    };
    for (const citizen of this.state.citizens) {
      if (!citizen.alive || !citizen.militiaType) continue;
      result[citizen.militiaType] += 1;
    }
    return result;
  }

  setMilitiaMobilized(mobilized: boolean): void {
    for (const citizen of this.state.citizens) {
      if (citizen.alive && citizen.militiaType) citizen.mobilized = mobilized;
    }
  }

  applyMilitiaCasualties(losses: Partial<MilitiaComposition>): number {
    let killed = 0;
    for (const type of MILITIA_TYPES) {
      let remaining = this.normalizeCount(losses[type]);
      if (remaining <= 0) continue;
      const assigned = this.state.citizens
        .filter((citizen) => citizen.alive && citizen.militiaType === type)
        .sort((a, b) => numericId(b.id) - numericId(a.id));
      for (const citizen of assigned) {
        if (remaining <= 0) break;
        citizen.alive = false;
        citizen.mobilized = false;
        citizen.militiaType = undefined;
        citizen.occupation = 'idle';
        citizen.workplace = undefined;
        killed += 1;
        remaining -= 1;
      }
    }
    this.reassignJobs(this.lastCells);
    return killed;
  }

  setProfessionalArmyCount(requested: number, cells: CellEntry[] = this.lastCells): number {
    this.lastCells = cells.map((cell) => ({ ...cell }));
    this.reconcileProfessionalArmyCamps(cells);

    const target = Math.min(this.normalizeCount(requested), this.professionalArmyCapacity(cells));
    let alive = this.state.professionalArmy
      .filter((soldier) => soldier.alive)
      .sort((a, b) => numericId(a.id) - numericId(b.id));

    while (alive.length > target) {
      const soldier = alive.pop();
      if (soldier) soldier.alive = false;
    }

    if (alive.length < target) {
      const camps = this.armyCamps(cells);
      const used = new Map<string, number>();
      for (const soldier of this.state.professionalArmy) {
        if (!soldier.alive || !soldier.camp) continue;
        const key = pointKey(soldier.camp);
        used.set(key, (used.get(key) ?? 0) + 1);
      }

      for (const camp of camps) {
        const key = pointKey(camp);
        const capacity = this.armyCampCapacity(camp.level);
        let occupied = used.get(key) ?? 0;
        while (alive.length < target && occupied < capacity) {
          const soldier: SavedProfessionalSoldierState = {
            id: `soldier-${this.state.nextSoldierId++}`,
            alive: true,
            unitType: 'swordsman',
            camp: { x: camp.x, y: camp.y },
          };
          this.state.professionalArmy.push(soldier);
          alive.push(soldier);
          occupied += 1;
        }
        used.set(key, occupied);
        if (alive.length >= target) break;
      }
    }

    this.reconcileProfessionalArmyCamps(cells);
    return this.state.professionalArmy.filter((soldier) => soldier.alive).length;
  }

  applyProfessionalCasualties(losses: number | Partial<MilitiaComposition>): number {
    if (typeof losses === 'number') {
      let remaining = this.normalizeCount(losses);
      let killed = 0;
      const alive = this.state.professionalArmy
        .filter((soldier) => soldier.alive)
        .sort((a, b) => numericId(b.id) - numericId(a.id));
      for (const soldier of alive) {
        if (remaining <= 0) break;
        soldier.alive = false;
        killed += 1;
        remaining -= 1;
      }
      return killed;
    }

    let killed = 0;
    for (const type of MILITIA_TYPES) {
      let remaining = this.normalizeCount(losses[type]);
      const matching = this.state.professionalArmy
        .filter((soldier) => soldier.alive && soldier.unitType === type)
        .sort((a, b) => numericId(b.id) - numericId(a.id));
      for (const soldier of matching) {
        if (remaining <= 0) break;
        soldier.alive = false;
        killed += 1;
        remaining -= 1;
      }
    }
    return killed;
  }

  professionalArmyCapacity(cells: CellEntry[] = this.lastCells): number {
    return this.armyCamps(cells).reduce(
      (sum, camp) => sum + this.armyCampCapacity(camp.level),
      0,
    );
  }

  professionalArmyComposition(): MilitiaComposition {
    const result: MilitiaComposition = { swordsman: 0, archer: 0, spearman: 0, crossbowman: 0 };
    for (const soldier of this.state.professionalArmy) {
      if (!soldier.alive) continue;
      const type = soldier.unitType === 'modernSoldier' ? 'swordsman' : soldier.unitType;
      result[type] += 1;
    }
    return result;
  }

  professionalArmyCampAssignments(): PopulationGridRef[] {
    return this.state.professionalArmy
      .filter((soldier) => soldier.alive && soldier.camp)
      .map((soldier) => ({ x: soldier.camp!.x, y: soldier.camp!.y }));
  }

  visibleCivilianRoster(maxGeneral = 40, maxFarmers = 40): PopulationRenderAssignment[] {
    const result: PopulationRenderAssignment[] = [];
    let general = 0;
    let farmers = 0;

    const living = this.state.citizens
      .filter((citizen) => citizen.alive && !citizen.militiaType)
      .sort((a, b) => numericId(a.id) - numericId(b.id));

    for (const citizen of living) {
      const home = clonePoint(citizen.home) ?? clonePoint(citizen.workplace);
      if (!home) continue;

      if (citizen.occupation === 'farmer') {
        if (farmers >= maxFarmers) continue;
        result.push({
          key: `population:${citizen.id}`,
          citizenId: citizen.id,
          role: 'farmer',
          home,
          work: clonePoint(citizen.workplace),
          seed: numericId(citizen.id) * 97 + 17,
        });
        farmers += 1;
        continue;
      }

      if (general >= maxGeneral) continue;
      result.push({
        key: `population:${citizen.id}`,
        citizenId: citizen.id,
        role: citizen.workplace ? 'worker' : 'citizen',
        home,
        work: clonePoint(citizen.workplace),
        seed: numericId(citizen.id) * 83 + 11,
      });
      general += 1;
    }

    return result;
  }

  private addCitizens(count: number, homes: CellEntry[]): void {
    if (count <= 0 || homes.length === 0) return;
    const homeSlots: PopulationGridRef[] = [];
    for (const home of homes) {
      const capacity = residentialCapacity(home);
      for (let i = 0; i < capacity; i += 1) homeSlots.push({ x: home.x, y: home.y });
    }
    if (homeSlots.length === 0) return;

    for (let i = 0; i < count; i += 1) {
      const id = this.state.nextCitizenId++;
      this.state.citizens.push({
        id: `citizen-${id}`,
        alive: true,
        home: clonePoint(homeSlots[(id - 1) % homeSlots.length]),
        occupation: 'idle',
        mobilized: false,
      });
    }
  }

  private homeCells(cells: CellEntry[]): CellEntry[] {
    return cells
      .filter((cell) => residentialCapacity(cell) > 0)
      .sort((a, b) => a.x - b.x || a.y - b.y);
  }

  private reassignMissingHomes(homes: CellEntry[]): void {
    const valid = new Set(homes.map((home) => `${home.x},${home.y}`));
    if (homes.length === 0) {
      for (const citizen of this.state.citizens) {
        if (citizen.alive) citizen.home = undefined;
      }
      return;
    }

    const homeSlots: PopulationGridRef[] = [];
    for (const home of homes) {
      const capacity = residentialCapacity(home);
      for (let i = 0; i < capacity; i += 1) homeSlots.push({ x: home.x, y: home.y });
    }

    let cursor = 0;
    for (const citizen of this.state.citizens) {
      if (!citizen.alive) continue;
      if (citizen.home && valid.has(pointKey(citizen.home))) continue;
      citizen.home = clonePoint(homeSlots[cursor % homeSlots.length]);
      cursor += 1;
    }
  }

  private reassignJobs(cells: CellEntry[]): void {
    if (!cells.length) return;

    const eligible = this.state.citizens
      .filter((citizen) => citizen.alive && !citizen.militiaType)
      .sort((a, b) => numericId(a.id) - numericId(b.id));

    for (const citizen of eligible) {
      citizen.occupation = 'idle';
      citizen.workplace = undefined;
    }

    let cursor = 0;
    const assign = (
      cell: CellEntry,
      occupation: Exclude<CivilianOccupation, 'idle' | 'militia'>,
      count: number,
    ): void => {
      for (let i = 0; i < count && cursor < eligible.length; i += 1) {
        const citizen = eligible[cursor++];
        citizen.occupation = occupation;
        citizen.workplace = { x: cell.x, y: cell.y };
      }
    };

    const workplaces = [...cells].sort((a, b) => a.x - b.x || a.y - b.y);
    for (const cell of workplaces) {
      if (cell.kind === 'farm') assign(cell, 'farmer', 8);
      else if (cell.kind === 'cowBarn') assign(cell, 'farmer', 6);
      else if (cell.kind === 'mine') assign(cell, 'miner', 5);
      else if (cell.kind === 'smallDock' || cell.kind === 'woodenPier') assign(cell, 'sailor', 2);
      else if (cell.kind === 'fishingDock') assign(cell, 'sailor', 5);
      else if (cell.kind === 'market') assign(cell, 'merchant', 20);
      else if (cell.kind === 'harbor') {
        assign(cell, 'sailor', 6);
        assign(cell, 'merchant', 6);
      } else if (cell.kind === 'windmill') assign(cell, 'worker', 4);
      else if (cell.kind === 'carpenter') {
        const level = Math.max(1, Math.min(4, Math.floor(cell.level ?? 1)));
        assign(cell, 'worker', level * 2);
      }
      else if (cell.kind === 'basilica') assign(cell, 'worker', 3);
    }

    const builderTarget = Math.min(16, Math.max(0, Math.floor(eligible.length * 0.08)));
    let builders = 0;
    while (cursor < eligible.length && builders < builderTarget) {
      eligible[cursor++].occupation = 'builder';
      builders += 1;
    }
  }

  private releaseMilitiaCitizen(citizen: SavedCitizenState): void {
    citizen.militiaType = undefined;
    citizen.mobilized = false;
    citizen.occupation = citizen.previousOccupation ?? 'idle';
    citizen.workplace = clonePoint(citizen.previousWorkplace);
    citizen.previousOccupation = undefined;
    citizen.previousWorkplace = undefined;
  }

  private armyCamps(cells: CellEntry[]): CellEntry[] {
    return cells
      .filter((cell) => cell.kind === 'armyCamp')
      .sort((a, b) => a.x - b.x || a.y - b.y);
  }

  private armyCampCapacity(level?: number): number {
    const normalized = Math.max(1, Math.min(4, Math.floor(Number(level) || 1)));
    return ARMY_CAMP_CAPACITY[normalized];
  }

  private reconcileProfessionalArmyCamps(cells: CellEntry[]): void {
    const camps = this.armyCamps(cells);
    const capacityByCamp = new Map<string, number>(
      camps.map((camp) => [pointKey(camp), this.armyCampCapacity(camp.level)]),
    );
    const used = new Map<string, number>();

    const alive = this.state.professionalArmy
      .filter((soldier) => soldier.alive)
      .sort((a, b) => numericId(a.id) - numericId(b.id));

    for (const soldier of alive) {
      const key = pointKey(soldier.camp);
      const capacity = capacityByCamp.get(key) ?? 0;
      const occupied = used.get(key) ?? 0;
      if (capacity > occupied) {
        used.set(key, occupied + 1);
        continue;
      }
      soldier.camp = undefined;
    }

    for (const soldier of alive) {
      if (soldier.camp) continue;
      let assigned = false;
      for (const camp of camps) {
        const key = pointKey(camp);
        const capacity = capacityByCamp.get(key) ?? 0;
        const occupied = used.get(key) ?? 0;
        if (occupied >= capacity) continue;
        soldier.camp = { x: camp.x, y: camp.y };
        used.set(key, occupied + 1);
        assigned = true;
        break;
      }

      // Removing military infrastructure retires overflow troops instead of duplicating
      // or teleport-spawning replacements. They can be recruited again through a camp.
      if (!assigned) soldier.alive = false;
    }

    // Stable camp assignments also migrate any saved modernSoldier identities.
    const slotByCamp = new Map<string, number>();
    for (const soldier of alive) {
      if (!soldier.alive || !soldier.camp) continue;
      const key = pointKey(soldier.camp);
      const slot = slotByCamp.get(key) ?? 0;
      soldier.unitType = GARRISON_ROLES[slot % GARRISON_ROLES.length];
      slotByCamp.set(key, slot + 1);
    }
  }

  private normalizeCount(value: unknown): number {
    const numeric = Number(value);
    return Math.max(0, Math.min(120, Math.floor(Number.isFinite(numeric) ? numeric : 0)));
  }
}
