import Phaser from 'phaser';
import type { ToolKind } from '../core/types';
import { GameState } from '../state/GameState';
import { BuildSystem } from '../systems/BuildSystem';
import { CameraController } from '../systems/CameraController';
import { EnvironmentSystem } from '../systems/EnvironmentSystem';
import { GridSystem } from '../systems/GridSystem';
import { PopulationSystem } from '../systems/PopulationSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { Toolbar } from '../ui/Toolbar';

export class GameScene extends Phaser.Scene {
  private readonly state = new GameState();
  private environment!: EnvironmentSystem;
  private grid!: GridSystem;
  private build!: BuildSystem;
  private population!: PopulationSystem;
  private cameraController!: CameraController;
  private saveSystem!: SaveSystem;
  private toolbar!: Toolbar;
  private selectedTool: ToolKind = 'wall';
  private lastPaintedCell = '';
  private autosaveTimer: number | null = null;

  constructor() { super('game'); }

  create(): void {
    const toolbarRoot = document.querySelector<HTMLElement>('#toolbar');
    const loadButton = document.querySelector<HTMLButtonElement>('#load-button');
    const saveButton = document.querySelector<HTMLButtonElement>('#save-button');
    const resetButton = document.querySelector<HTMLButtonElement>('#reset-button');
    if (!toolbarRoot || !loadButton || !saveButton || !resetButton) throw new Error('Game UI did not initialize');

    this.environment = new EnvironmentSystem(this);
    this.grid = new GridSystem(this);
    this.saveSystem = new SaveSystem(this.state, (message) => this.setStatus(message));
    this.saveSystem.load();
    this.build = new BuildSystem(this.state, this.environment, this);
    this.population = new PopulationSystem(this, this.state);
    this.cameraController = new CameraController(this);

    this.toolbar = new Toolbar(toolbarRoot, (tool) => {
      this.selectedTool = tool;
      this.lastPaintedCell = '';
    });

    loadButton.addEventListener('click', () => {
      this.saveSystem.load();
      this.build.redraw();
      this.setStatus('Construction loaded');
    });
    saveButton.addEventListener('click', () => this.saveSystem.save());
    resetButton.addEventListener('click', () => this.resetMap());

    this.bindShortcuts();
    this.bindBuildingInput();
    this.setStatus(this.state.entries().length > 0 ? 'Local save loaded' : 'Lay out walls, roads, and homes');
  }

  update(_time: number, delta: number): void {
    this.cameraController.update(delta);
    this.population.update(delta);
    const pointer = this.input.activePointer;
    const cell = this.grid.pointerToCell(pointer);
    const valid = cell ? this.build.canApply(cell.x, cell.y, this.selectedTool) : false;
    this.grid.setHover(cell, valid);
  }

  private bindShortcuts(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.on('keydown-ONE', () => this.toolbar.select('wall'));
    keyboard.on('keydown-TWO', () => this.toolbar.select('road'));
    keyboard.on('keydown-THREE', () => this.toolbar.select('cottage'));
    keyboard.on('keydown-FOUR', () => this.toolbar.select('house'));
    keyboard.on('keydown-FIVE', () => this.toolbar.select('manor'));
    keyboard.on('keydown-SIX', () => this.toolbar.select('erase'));
  }

  private bindBuildingInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) this.applyPointer(pointer);
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown() && !this.cameraController.isDragging()) this.applyPointer(pointer);
    });
    this.input.on('pointerup', () => { this.lastPaintedCell = ''; });
  }

  private applyPointer(pointer: Phaser.Input.Pointer): void {
    const cell = this.grid.pointerToCell(pointer);
    if (!cell) return;
    const key = `${cell.x},${cell.y}`;
    if (key === this.lastPaintedCell) return;
    this.lastPaintedCell = key;
    if (this.build.apply(cell.x, cell.y, this.selectedTool)) this.scheduleAutosave();
  }

  private scheduleAutosave(): void {
    if (this.autosaveTimer !== null) window.clearTimeout(this.autosaveTimer);
    this.setStatus('Unsaved changes…');
    this.autosaveTimer = window.setTimeout(() => {
      this.saveSystem.save();
      this.autosaveTimer = null;
    }, 450);
  }

  private resetMap(): void {
    const confirmed = window.confirm('Reset the entire map and delete the local save?');
    if (!confirmed) return;
    if (this.autosaveTimer !== null) {
      window.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    this.saveSystem.reset();
    this.build.redraw();
  }

  private setStatus(message: string): void {
    const element = document.querySelector<HTMLElement>('#save-status');
    if (element) element.textContent = message;
  }
}
