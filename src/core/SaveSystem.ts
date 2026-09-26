import {
  SAVE_AUTOSAVE_KEY,
  SAVE_KEY,
  SAVE_LEGACY_KEY,
  SAVE_QUICK_KEY,
  SAVE_SLOT_COUNT,
  SAVE_STORAGE_PREFIX,
  SAVE_VERSION,
  WORLD_COLS,
} from './constants';
import type { GameMode } from './GameMode';
import { isGameMode } from './GameMode';
import type { GameState } from '../state/GameState';
import type { KeepSystem } from '../building/KeepSystem';
import { APPLICATION_METADATA } from '../app/applicationMetadata';
import type {
  KeepState,
  SavedBattleSetup,
  SavedGame,
  SaveMetadata,
  SaveRecord,
  ShipKind,
  StoneStyle,
  TerrainOverrideKind,
  TowerBridgeState,
  TowerShape,
  TowerTop,
  WallDirection,
  WallThickness,
} from './types';

type SaveTarget = number | 'quick' | 'autosave';

export interface SaveLoadHost {
  readonly state: GameState;
  readonly keepSystem: KeepSystem;
  readonly terrainOverrides: Map<string, TerrainOverrideKind>;
  readonly elevationOverrides: Map<string, number>;
  readonly towerBridges: Map<number, TowerBridgeState>;
  getGameMode(): GameMode;
  getStoneStyle(): StoneStyle;
  getWorldSeeded(): boolean;
  getBattleSetup?(): SavedBattleSetup;
  setBattleSetup?(value: SavedBattleSetup): void;
  setWorldSeeded(value: boolean): void;
  setLoadedSaveVersion(value: number): void;
  setStoneStyle(value: StoneStyle): void;
  migrateKind(kind: string, level: number): { kind: string; level: number } | null;
  isBuildingAvailable(kind: string): boolean;
  key(x: number, y: number): string;
  updateGameModeUI(): void;
  syncTemplateAvailability(): void;
  setStatus(message: string): void;
  prepareForLoad?(): void;
  afterLoad?(): void;
}

interface RawSave {
  metadata?: Partial<SaveMetadata>;
  data?: SavedGame;
  version?: number;
  updatedAt?: number;
  gameMode?: unknown;
  cells?: SavedGame['cells'];
  keeps?: KeepState[];
  stoneStyle?: StoneStyle;
  towerBridges?: TowerBridgeState[];
  terrain?: SavedGame['terrain'];
  elevations?: SavedGame['elevations'];
  worldSeeded?: boolean;
  battleSetup?: SavedBattleSetup;
}

export class SaveSystem {
  private dirty = false;
  private modal: HTMLElement | null = null;
  private dialogMode: 'save' | 'load' = 'load';

  constructor(private readonly host: SaveLoadHost) {
    this.installToolbarInterceptors();
  }

  private installToolbarInterceptors(): void {
    if (typeof document === 'undefined') return;
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>('#save-button, #load-button');
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (button.id === 'save-button') this.openSaveDialog();
      else this.openLoadDialog();
    }, true);
  }

  static hasAnySave(): boolean {
    if (typeof localStorage === 'undefined') return false;
    if (localStorage.getItem(SAVE_KEY)) return true;
    if (localStorage.getItem(SAVE_AUTOSAVE_KEY) || localStorage.getItem(SAVE_QUICK_KEY)) return true;
    for (let slot = 1; slot <= SAVE_SLOT_COUNT; slot += 1) {
      if (localStorage.getItem(slotKey(slot))) return true;
    }
    return false;
  }

  markDirty(): void {
    this.dirty = true;
  }

  isDirty(): boolean {
    return this.dirty;
  }

  /** Existing game mutations use this as a throttled auto-save. */
  save(updateStatus = true): boolean {
    return this.autoSave(updateStatus);
  }

  autoSave(updateStatus = true): boolean {
    this.dirty = true;
    const ok = this.writeRecord('autosave', 'Auto Save', updateStatus);
    if (ok && updateStatus) this.host.setStatus('Auto-saved');
    return ok;
  }

  quickSave(): boolean {
    const ok = this.writeRecord('quick', 'Quick Save', true);
    if (ok) this.dirty = false;
    return ok;
  }

  manualSave(slot: number, name?: string): boolean {
    if (!Number.isInteger(slot) || slot < 1 || slot > SAVE_SLOT_COUNT) return false;
    const existing = this.readRecord(slot);
    const finalName = normalizeName(name || existing?.metadata.name || `Save Slot ${slot}`);
    const ok = this.writeRecord(slot, finalName, true, existing?.metadata.createdAt);
    if (ok) {
      this.dirty = false;
      this.host.setStatus(`Saved to Slot ${slot}`);
    }
    return ok;
  }

  load(): boolean {
    const records = this.listRecords();
    if (records.length === 0) {
      this.migrateLegacySave();
      const migrated = this.listRecords();
      if (migrated.length === 0) return false;
      return this.applyRecord(migrated.sort((a, b) => b.metadata.updatedAt - a.metadata.updatedAt)[0]);
    }

    const record = records.sort((a, b) => b.metadata.updatedAt - a.metadata.updatedAt)[0];
    return this.applyRecord(record);
  }

  loadTarget(target: SaveTarget): boolean {
    const record = this.readRecord(target);
    if (!record) {
      this.host.setStatus('Save not found');
      return false;
    }
    return this.applyRecord(record);
  }

  rename(target: SaveTarget, name: string): boolean {
    const record = this.readRecord(target);
    if (!record || target === 'autosave') return false;
    record.metadata.name = normalizeName(name || record.metadata.name);
    return this.writeRaw(target, record);
  }

  delete(target: SaveTarget): boolean {
    if (target === 'autosave' || !this.readRecord(target)) return false;
    localStorage.removeItem(storageKey(target));
    this.host.setStatus('Save deleted');
    return true;
  }

  openSaveDialog(): void {
    this.openDialog('save');
  }

  openLoadDialog(): void {
    this.openDialog('load');
  }

  private openDialog(mode: 'save' | 'load'): void {
    this.dialogMode = mode;
    this.ensureModal();
    this.renderModal();
    if (this.modal) this.modal.hidden = false;
  }

  private ensureModal(): void {
    if (this.modal) return;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.hidden = true;
    backdrop.innerHTML =
      '<section class="help-modal" role="dialog" aria-modal="true" aria-labelledby="save-load-title">' +
      '<div class="help-modal-header">' +
      '<div><div class="eyebrow">CASTLE ROLE · STORAGE</div><h2 id="save-load-title"></h2></div>' +
      '<button type="button" class="icon-button" data-save-close aria-label="Close">×</button>' +
      '</div>' +
      '<p class="template-intro" data-save-description></p>' +
      '<div data-save-list></div>' +
      '</section>';

    document.body.appendChild(backdrop);
    this.modal = backdrop;

    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) backdrop.hidden = true;
      const target = event.target as HTMLElement;
      const action = target.dataset.saveAction;
      const targetValue = target.dataset.saveTarget;
      if (!action) return;

      if (action === 'close') backdrop.hidden = true;
      if (action === 'quick') {
        this.quickSave();
        this.renderModal();
      }
      if (action === 'save-slot' && targetValue) this.handleManualSave(Number(targetValue));
      if (action === 'load' && targetValue) this.handleLoad(targetValue);
      if (action === 'rename' && targetValue) this.handleRename(targetValue);
      if (action === 'delete' && targetValue) this.handleDelete(targetValue);
    });
  }

  private renderModal(): void {
    if (!this.modal) return;
    const title = this.modal.querySelector<HTMLElement>('#save-load-title');
    const description = this.modal.querySelector<HTMLElement>('[data-save-description]');
    const list = this.modal.querySelector<HTMLElement>('[data-save-list]');
    if (!title || !description || !list) return;

    title.textContent = this.dialogMode === 'save' ? 'Save Game' : 'Load Game';
    description.textContent = this.dialogMode === 'save'
      ? 'Manual slots are protected from Auto Save. Quick Save and Auto Save use separate storage.'
      : 'Select a saved world to restore. Runtime rendering, battle units and transient effects are rebuilt after loading.';

    const records = new Map<string, SaveRecord>();
    for (const record of this.listRecords()) records.set(String(record.metadata.slot), record);

    const cards: string[] = [];
    for (let slot = 1; slot <= SAVE_SLOT_COUNT; slot += 1) {
      const record = records.get(String(slot));
      cards.push(this.renderCard(slot, record));
    }

    const quick = records.get('quick');
    cards.push(this.renderSpecialCard('quick', 'Quick Save', quick, true));

    const auto = records.get('autosave');
    cards.push(this.renderSpecialCard('autosave', 'Auto Save', auto, false));

    list.innerHTML = '<div class="template-grid">' + cards.join('') + '</div>';
  }

  private renderCard(slot: number, record?: SaveRecord): string {
    const meta = record?.metadata;
    const details = meta
      ? this.metadataText(meta)
      : '<span>Empty slot</span>';
    if (this.dialogMode === 'save') {
      return '<article class="template-card">' +
        '<strong>Save Slot ' + slot + '</strong>' +
        details +
        '<button class="secondary-button" type="button" data-save-action="save-slot" data-save-target="' + slot + '">' +
        (meta ? 'Overwrite' : 'Save') + '</button>' +
        '</article>';
    }

    return '<article class="template-card">' +
      '<strong>Save Slot ' + slot + '</strong>' +
      details +
      (meta
        ? '<div class="settings-actions">' +
          '<button class="secondary-button" type="button" data-save-action="load" data-save-target="' + slot + '">Load</button>' +
          '<button class="secondary-button" type="button" data-save-action="rename" data-save-target="' + slot + '">Rename</button>' +
          '<button class="danger-button" type="button" data-save-action="delete" data-save-target="' + slot + '">Delete</button>' +
          '</div>'
        : '<span>Nothing to load</span>') +
      '</article>';
  }

  private renderSpecialCard(target: 'quick' | 'autosave', label: string, record?: SaveRecord, writable = false): string {
    const details = record ? this.metadataText(record.metadata) : '<span>Empty</span>';
    if (this.dialogMode === 'save' && writable) {
      return '<article class="template-card">' +
        '<strong>' + label + '</strong>' + details +
        '<button class="secondary-button" type="button" data-save-action="quick">Quick Save</button>' +
        '</article>';
    }
    return '<article class="template-card">' +
      '<strong>' + label + '</strong>' + details +
      (record && this.dialogMode === 'load'
        ? '<button class="secondary-button" type="button" data-save-action="load" data-save-target="' + target + '">Load</button>'
        : '') +
      '</article>';
  }

  private metadataText(meta: SaveMetadata): string {
    const date = new Date(meta.updatedAt).toLocaleString();
    return '<small>' +
      escapeHtml(meta.name) + ' · ' + escapeHtml(date) + '<br>' +
      escapeHtml(meta.gameMode ? meta.gameMode : 'Unknown mode') + ' · ' +
      meta.summary.buildings + ' buildings · ' + meta.summary.keeps + ' keeps' +
      '</small>';
  }

  private handleManualSave(slot: number): void {
    const existing = this.readRecord(slot);
    if (existing && !confirm(`Overwrite Save Slot ${slot}?`)) return;
    const name = prompt('Save name', existing?.metadata.name || `Save Slot ${slot}`);
    if (name === null) return;
    this.manualSave(slot, name);
    this.renderModal();
  }

  private handleLoad(target: string): void {
    if (!this.confirmDiscardForLoad()) return;
    const parsed: SaveTarget = target === 'quick' || target === 'autosave' ? target : Number(target);
    this.loadTarget(parsed);
    this.renderModal();
    if (this.modal) this.modal.hidden = true;
  }

  private handleRename(target: string): void {
    const parsed: SaveTarget = Number(target);
    const record = this.readRecord(parsed);
    if (!record) return;
    const name = prompt('Save name', record.metadata.name);
    if (name === null) return;
    this.rename(parsed, name);
    this.renderModal();
  }

  private handleDelete(target: string): void {
    const parsed: SaveTarget = Number(target);
    if (!confirm(`Delete Save Slot ${parsed}? This cannot be undone.`)) return;
    this.delete(parsed);
    this.renderModal();
  }

  private confirmDiscardForLoad(): boolean {
    if (!this.dirty) return true;
    const saveBeforeLoad = confirm('There are changes since the last manual save. Press OK to Quick Save before loading, or Cancel to abort.');
    if (saveBeforeLoad) return this.quickSave();
    return confirm('Discard the current changes and continue loading?');
  }

  private writeRecord(
    target: SaveTarget,
    name: string,
    updateStatus: boolean,
    createdAtOverride?: number,
  ): boolean {
    try {
      const data = this.createData();
      const now = Date.now();
      const previous = this.readRecord(target);
      const metadata: SaveMetadata = {
        id: previous?.metadata.id || makeId(),
        slot: target,
        name: normalizeName(name),
        createdAt: createdAtOverride ?? previous?.metadata.createdAt ?? now,
        updatedAt: now,
        schemaVersion: SAVE_VERSION,
        gameVersion: getGameVersion(),
        gameMode: data.gameMode,
        summary: {
          buildings: data.cells.length,
          keeps: data.keeps?.length ?? 0,
          terrainChanges: data.terrain?.length ?? 0,
          elevations: data.elevations?.length ?? 0,
        },
      };
      return this.writeRaw(target, { metadata, data }, updateStatus);
    } catch {
      this.host.setStatus('Could not save game');
      return false;
    }
  }

  private writeRaw(target: SaveTarget, record: SaveRecord, updateStatus = true): boolean {
    try {
      const key = storageKey(target);
      const tempKey = key + '.tmp';
      localStorage.setItem(tempKey, JSON.stringify(record));
      const verified = localStorage.getItem(tempKey);
      if (!verified) throw new Error('Save verification failed');
      JSON.parse(verified);
      localStorage.setItem(key, verified);
      localStorage.setItem(SAVE_KEY, '1');
      localStorage.removeItem(tempKey);
      if (updateStatus) this.host.setStatus('Saved');
      return true;
    } catch {
      try { localStorage.removeItem(storageKey(target) + '.tmp'); } catch { /* ignore */ }
      this.host.setStatus('Could not save game');
      return false;
    }
  }

  private createData(): SavedGame {
    const terrain = Array.from(this.host.terrainOverrides.entries()).map(([key, kind]) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y, kind };
    });
    const elevations = Array.from(this.host.elevationOverrides.entries()).map(([key, value]) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y, value };
    });

    return {
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
      battleSetup: this.host.getBattleSetup ? { ...this.host.getBattleSetup() } : undefined,
    };
  }

  private applyRecord(record: SaveRecord): boolean {
    const validation = this.validateRecord(record);
    if (!validation.ok) {
      this.host.setStatus(validation.message);
      return false;
    }

    const backup = this.createData();
    try {
      this.host.prepareForLoad?.();
      this.applyData(record.data);
      this.dirty = false;
      this.host.afterLoad?.();
      this.host.setStatus('Loaded');
      return true;
    } catch {
      try {
        this.host.prepareForLoad?.();
        this.applyData(backup);
        this.host.afterLoad?.();
      } catch {
        // The normal path should not fail after validation. Do not mask the original load error.
      }
      this.host.setStatus('Could not load save · current game restored');
      return false;
    }
  }

  private applyData(data: SavedGame): void {
    const loadedMode: GameMode = isGameMode(data.gameMode) ? data.gameMode : 'medieval';
    const cells: Array<ReturnType<GameState['entries']>[number]> = [];

    for (const cell of data.cells ?? []) {
      if (!validGrid(cell.x, cell.y)) continue;
      const migration = this.host.migrateKind(cell.kind, cell.level ?? 1);
      if (!migration || !this.host.isBuildingAvailable(migration.kind)) continue;
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

    this.host.state.setGameMode(loadedMode);
    this.host.state.replace(cells);
    this.host.keepSystem.replace(data.keeps ?? []);
    this.host.setStoneStyle(validStoneStyle(data.stoneStyle) ? data.stoneStyle! : 'limestone');

    this.host.towerBridges.clear();
    for (const bridge of data.towerBridges ?? []) {
      if (!Number.isInteger(bridge.id) || !validGrid(bridge.ax, bridge.ay) || !validGrid(bridge.bx, bridge.by)) continue;
      if (bridge.kind !== 'stone' && bridge.kind !== 'wood') continue;
      this.host.towerBridges.set(bridge.id, { ...bridge });
    }

    this.host.terrainOverrides.clear();
    this.host.elevationOverrides.clear();

    for (const terrainCell of data.terrain ?? []) {
      if (!validGrid(terrainCell.x, terrainCell.y)) continue;
      if (terrainCell.kind !== 'plains' && terrainCell.kind !== 'river') continue;
      this.host.terrainOverrides.set(this.host.key(terrainCell.x, terrainCell.y), terrainCell.kind);
    }

    for (const elevationCell of data.elevations ?? []) {
      if (!validGrid(elevationCell.x, elevationCell.y) || !Number.isFinite(elevationCell.value)) continue;
      this.host.elevationOverrides.set(
        this.host.key(elevationCell.x, elevationCell.y),
        clamp(elevationCell.value, -6, 6),
      );
    }

    this.host.setWorldSeeded(Boolean(data.worldSeeded));
    this.host.setLoadedSaveVersion(Math.max(0, Math.floor(data.version ?? 0)));
    if (data.battleSetup) this.host.setBattleSetup?.(normalizeBattleSetup(data.battleSetup));
    this.host.updateGameModeUI();
    this.host.syncTemplateAvailability();
  }

  private validateRecord(record: SaveRecord): { ok: true } | { ok: false; message: string } {
    const meta = record.metadata;
    const data = record.data;
    if (!meta || !data || typeof meta !== 'object' || typeof data !== 'object') {
      return { ok: false, message: 'Invalid save format' };
    }
    if (!Number.isInteger(meta.schemaVersion) || meta.schemaVersion < 0 || meta.schemaVersion > SAVE_VERSION) {
      return { ok: false, message: 'Incompatible save version' };
    }
    if (!Array.isArray(data.cells)) return { ok: false, message: 'Invalid save data' };
    if (data.cells.length > WORLD_COLS * WORLD_COLS * 4) return { ok: false, message: 'Save is too large or malformed' };
    return { ok: true };
  }

  private readRecord(target: SaveTarget): SaveRecord | null {
    try {
      const raw = localStorage.getItem(storageKey(target));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as RawSave;
      return normalizeRecord(parsed, target);
    } catch {
      return null;
    }
  }

  private listRecords(): SaveRecord[] {
    const records: SaveRecord[] = [];
    for (let slot = 1; slot <= SAVE_SLOT_COUNT; slot += 1) {
      const record = this.readRecord(slot);
      if (record) records.push(record);
    }
    const quick = this.readRecord('quick');
    const autosave = this.readRecord('autosave');
    if (quick) records.push(quick);
    if (autosave) records.push(autosave);
    return records;
  }

  private migrateLegacySave(): void {
    try {
      const raw = localStorage.getItem(SAVE_LEGACY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as RawSave;
      const data = parsed.data ?? {
        version: Number(parsed.version ?? 0),
        gameMode: parsed.gameMode,
        updatedAt: Number(parsed.updatedAt ?? Date.now()),
        cells: parsed.cells ?? [],
        keeps: parsed.keeps ?? [],
        stoneStyle: parsed.stoneStyle,
        towerBridges: parsed.towerBridges,
        terrain: parsed.terrain,
        elevations: parsed.elevations,
        worldSeeded: parsed.worldSeeded,
        battleSetup: parsed.battleSetup,
      };
      if (!Array.isArray(data.cells)) return;
      const now = Number(data.updatedAt) || Date.now();
      const metadata: SaveMetadata = {
        id: makeId(), slot: 'autosave', name: 'Migrated Save', createdAt: now, updatedAt: now,
        schemaVersion: Number(data.version) || 0, gameVersion: getGameVersion(), gameMode: data.gameMode,
        summary: { buildings: data.cells.length, keeps: data.keeps?.length ?? 0, terrainChanges: data.terrain?.length ?? 0, elevations: data.elevations?.length ?? 0 },
      };
      this.writeRaw('autosave', { metadata, data });
      localStorage.removeItem(SAVE_LEGACY_KEY);
    } catch {
      // A malformed legacy save is ignored; it must never prevent a new game.
    }
  }
}

function storageKey(target: SaveTarget): string {
  if (target === 'quick') return SAVE_QUICK_KEY;
  if (target === 'autosave') return SAVE_AUTOSAVE_KEY;
  return `${SAVE_STORAGE_PREFIX}slot-${target}`;
}

function slotKey(slot: number): string {
  return `${SAVE_STORAGE_PREFIX}slot-${slot}`;
}

function normalizeRecord(raw: RawSave, target: SaveTarget): SaveRecord | null {
  const data = raw.data ?? (Array.isArray(raw.cells) ? {
    version: Number(raw.version ?? 0),
    gameMode: isGameMode(raw.gameMode) ? raw.gameMode : undefined,
    updatedAt: Number(raw.updatedAt ?? Date.now()),
    cells: raw.cells,
    keeps: raw.keeps,
    stoneStyle: raw.stoneStyle,
    towerBridges: raw.towerBridges,
    terrain: raw.terrain,
    elevations: raw.elevations,
    worldSeeded: raw.worldSeeded,
    battleSetup: raw.battleSetup,
  } : undefined);
  if (!data || !Array.isArray(data.cells)) return null;

  const now = Number(data.updatedAt) || Date.now();
  const metadata: SaveMetadata = {
    id: typeof raw.metadata?.id === 'string' ? raw.metadata.id : makeId(),
    slot: target,
    name: normalizeName(typeof raw.metadata?.name === 'string' ? raw.metadata.name : target === 'autosave' ? 'Auto Save' : target === 'quick' ? 'Quick Save' : `Save Slot ${target}`),
    createdAt: Number(raw.metadata?.createdAt) || now,
    updatedAt: Number(raw.metadata?.updatedAt) || now,
    schemaVersion: Number(raw.metadata?.schemaVersion ?? data.version ?? 0),
    gameVersion: typeof raw.metadata?.gameVersion === 'string' ? raw.metadata.gameVersion : undefined,
    gameMode: isGameMode(raw.metadata?.gameMode) ? raw.metadata.gameMode : data.gameMode,
    summary: raw.metadata?.summary ?? {
      buildings: data.cells.length,
      keeps: data.keeps?.length ?? 0,
      terrainChanges: data.terrain?.length ?? 0,
      elevations: data.elevations?.length ?? 0,
    },
  };
  return { metadata, data };
}

function normalizeBattleSetup(input: SavedBattleSetup): SavedBattleSetup {
  const fields: Array<keyof SavedBattleSetup> = [
    'attackerSwordsmen', 'attackerArchers', 'attackerSpearmen', 'attackerCrossbowmen',
    'attackerModernSoldiers', 'defenderSwordsmen', 'defenderArchers', 'defenderSpearmen',
    'defenderCrossbowmen', 'defenderModernSoldiers',
  ];
  const result = {} as SavedBattleSetup;
  for (const field of fields) result[field] = clamp(Math.floor(Number(input[field]) || 0), 0, 120);
  return result;
}

function validGrid(x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < WORLD_COLS && y < WORLD_COLS;
}

function validStoneStyle(value: unknown): value is StoneStyle {
  return value === 'limestone' || value === 'darkStone' || value === 'sandstone' || value === 'frontier';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeName(value: string): string {
  const trimmed = value.trim().replace(/\\s+/g, ' ');
  return trimmed.slice(0, 80) || 'Untitled Save';
}

function makeId(): string {
  return `save-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getGameVersion(): string | undefined {
  try {
    const module = globalThis as typeof globalThis & {
      __CASTLE_GAME_VERSION__?: string;
    };
    return module.__CASTLE_GAME_VERSION__;
  } catch {
    return undefined;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char] ?? char));
}
