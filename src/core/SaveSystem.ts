import { SAVE_KEY, SAVE_VERSION, WORLD_COLS } from './constants';
import type { GameMode } from './GameMode';
import { isGameMode } from './GameMode';
import type { GameState } from '../state/GameState';
import type { KeepSystem } from '../building/KeepSystem';
import type {
  KeepState,
  SavedGame,
  ShipKind,
  StoneStyle,
  TerrainOverrideKind,
  TowerBridgeState,
  TowerShape,
  TowerTop,
  WallDirection,
  WallThickness,
} from './types';

export interface SaveLoadHost {
  readonly state: GameState;
  readonly keepSystem: KeepSystem;
  readonly terrainOverrides: Map<string, TerrainOverrideKind>;
  readonly elevationOverrides: Map<string, number>;
  readonly towerBridges: Map<number, TowerBridgeState>;
  getGameMode(): GameMode;
  getStoneStyle(): StoneStyle;
  getWorldSeeded(): boolean;
  setWorldSeeded(value: boolean): void;
  setLoadedSaveVersion(value: number): void;
  setStoneStyle(value: StoneStyle): void;
  migrateKind(kind: string, level: number): { kind: string; level: number } | null;
  isBuildingAvailable(kind: string): boolean;
  key(x: number, y: number): string;
  updateGameModeUI(): void;
  syncTemplateAvailability(): void;
  setStatus(message: string): void;
}

export class SaveSystem {
  constructor(private readonly host: SaveLoadHost) {}

  save(updateStatus = true): void {
    const terrain = Array.from(this.host.terrainOverrides.entries()).map(([key, kind]) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y, kind };
    });

    const elevations = Array.from(this.host.elevationOverrides.entries()).map(([key, value]) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y, value };
    });

    const data: SavedGame = {
      version: SAVE_VERSION,
      gameMode: this.host.getGameMode(),
      updatedAt: Date.now(),
      cells: this.host.state.entries(),
      keeps: this.host.keepSystem.entries(),
      stoneStyle: this.host.getStoneStyle(),
      towerBridges: Array.from(this.host.towerBridges.values()).map((bridge) => ({ ...bridge })),
      terrain,
      elevations,
      worldSeeded: this.host.getWorldSeeded(),
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    if (updateStatus) this.host.setStatus('Saved');
  }

  load(): void {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;

    try {
      const data = JSON.parse(raw) as {
        version?: number;
        gameMode?: unknown;
        cells?: Array<{
          x: number;
          y: number;
          kind: string;
          level?: number;
          thickness?: WallThickness;
          battlement?: boolean;
          walkway?: boolean;
          towerShape?: TowerShape;
          towerTop?: TowerTop;
          rotation?: number;
          wallLinks?: WallDirection[];
          shipKind?: ShipKind;
          accessHeight?: number;
          damage?: number;
        }>;
        keeps?: KeepState[];
        stoneStyle?: StoneStyle;
        towerBridges?: TowerBridgeState[];
        terrain?: Array<{ x: number; y: number; kind: TerrainOverrideKind }>;
        elevations?: Array<{ x: number; y: number; value: number }>;
        worldSeeded?: boolean;
      };

      const loadedMode: GameMode = isGameMode(data.gameMode) ? data.gameMode : 'medieval';
      this.host.state.setGameMode(loadedMode);
      const cells: Array<ReturnType<GameState['entries']>[number]> = [];
      let skippedIncompatible = false;

      for (const cell of data.cells ?? []) {
        if (cell.x < 0 || cell.y < 0 || cell.x >= WORLD_COLS || cell.y >= WORLD_COLS) continue;

        const migration = this.host.migrateKind(cell.kind, cell.level ?? 1);
        if (!migration) continue;
        if (!this.host.isBuildingAvailable(migration.kind)) {
          skippedIncompatible = true;
          continue;
        }

        cells.push({
          x: cell.x,
          y: cell.y,
          kind: migration.kind as ReturnType<GameState['entries']>[number]['kind'],
          level: migration.level,
          thickness: cell.thickness,
          battlement: cell.battlement,
          walkway: cell.walkway,
          towerShape: cell.towerShape,
          towerTop: cell.towerTop,
          rotation: cell.rotation,
          wallLinks: cell.wallLinks,
          shipKind: cell.shipKind,
          accessHeight: cell.accessHeight,
          damage: clamp(cell.damage ?? 0, 0, 1),
        });
      }

      this.host.state.replace(cells);
      this.host.keepSystem.replace(data.keeps ?? []);
      this.host.setStoneStyle(
        data.stoneStyle === 'darkStone' ||
        data.stoneStyle === 'sandstone' ||
        data.stoneStyle === 'frontier'
          ? data.stoneStyle
          : 'limestone',
      );

      this.host.towerBridges.clear();
      for (const bridge of data.towerBridges ?? []) {
        if (
          !Number.isInteger(bridge.id) ||
          !Number.isInteger(bridge.ax) ||
          !Number.isInteger(bridge.ay) ||
          !Number.isInteger(bridge.bx) ||
          !Number.isInteger(bridge.by)
        ) continue;
        if (bridge.kind !== 'stone' && bridge.kind !== 'wood') continue;
        this.host.towerBridges.set(bridge.id, { ...bridge });
      }

      this.host.terrainOverrides.clear();
      this.host.elevationOverrides.clear();

      for (const terrainCell of data.terrain ?? []) {
        if (
          terrainCell.x < 0 ||
          terrainCell.y < 0 ||
          terrainCell.x >= WORLD_COLS ||
          terrainCell.y >= WORLD_COLS
        ) continue;
        if (terrainCell.kind !== 'plains' && terrainCell.kind !== 'river') continue;
        this.host.terrainOverrides.set(
          this.host.key(terrainCell.x, terrainCell.y),
          terrainCell.kind,
        );
      }

      for (const elevationCell of data.elevations ?? []) {
        if (
          elevationCell.x < 0 ||
          elevationCell.y < 0 ||
          elevationCell.x >= WORLD_COLS ||
          elevationCell.y >= WORLD_COLS
        ) continue;
        if (!Number.isFinite(elevationCell.value)) continue;
        this.host.elevationOverrides.set(
          this.host.key(elevationCell.x, elevationCell.y),
          clamp(elevationCell.value, -6, 6),
        );
      }

      this.host.setWorldSeeded(Boolean(data.worldSeeded));
      this.host.setLoadedSaveVersion(Math.max(0, Math.floor(data.version ?? 0)));
      this.host.updateGameModeUI();
      this.host.syncTemplateAvailability();
      this.host.setStatus(
        skippedIncompatible
          ? 'Loaded · incompatible mode content skipped'
          : 'Loaded',
      );
    } catch {
      this.host.setStatus('Could not load save');
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
