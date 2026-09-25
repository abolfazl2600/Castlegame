import Phaser from 'phaser';
import { TILE_SIZE, WORLD_HEIGHT, WORLD_WIDTH } from '../core/constants';
import type { UnitKind } from '../core/types';
import { GameState } from '../state/GameState';

interface UnitAgent {
  kind: UnitKind;
  view: Phaser.GameObjects.Container;
  target: Phaser.Math.Vector2;
  speed: number;
  pauseMs: number;
  phase: number;
}

export class PopulationSystem {
  private readonly units: UnitAgent[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: GameState,
  ) {
    const centerX = WORLD_WIDTH / 2;
    const centerY = WORLD_HEIGHT / 2;

    for (let i = 0; i < 7; i += 1) this.units.push(this.createUnit('worker', centerX + (i - 3) * 18, centerY + 42));
    for (let i = 0; i < 4; i += 1) this.units.push(this.createUnit('soldier', centerX + (i - 2) * 22, centerY - 40));
  }

  update(delta: number): void {
    for (const unit of this.units) {
      unit.phase += delta * 0.006;

      if (unit.pauseMs > 0) {
        unit.pauseMs -= delta;
        unit.view.setScale(1, 1 + Math.sin(unit.phase) * 0.025);
        continue;
      }

      const dx = unit.target.x - unit.view.x;
      const dy = unit.target.y - unit.view.y;
      const distance = Math.hypot(dx, dy);

      if (distance < 5) {
        unit.pauseMs = unit.kind === 'worker' ? Phaser.Math.Between(900, 2200) : Phaser.Math.Between(350, 800);
        unit.target = this.chooseTarget(unit.kind);
        continue;
      }

      const step = Math.min(distance, unit.speed * delta / 1000);
      unit.view.x += (dx / distance) * step;
      unit.view.y += (dy / distance) * step;
      unit.view.setDepth(30 + unit.view.y / 10000);
      unit.view.setScale(1, 1 + Math.sin(unit.phase) * 0.018);
    }
  }

  private createUnit(kind: UnitKind, x: number, y: number): UnitAgent {
    const container = this.scene.add.container(x, y).setDepth(30 + y / 10000);
    const shadow = this.scene.add.ellipse(0, 8, 15, 6, 0x0b1220, 0.18);
    const body = this.scene.add.graphics();

    if (kind === 'worker') {
      body.fillStyle(0xd98f56, 1);
      body.fillRoundedRect(-5, -2, 10, 12, 3);
      body.fillStyle(0xf1d4c0, 1);
      body.fillCircle(0, -6, 5);
      body.fillStyle(0xeac95e, 1);
      body.fillRect(-6, -10, 12, 3);
      body.lineStyle(2, 0x7c5236, 1);
      body.lineBetween(5, 1, 9, 7);
      body.lineBetween(8, 5, 11, 3);
    } else {
      body.fillStyle(0x5f8fb4, 1);
      body.fillRoundedRect(-5, -2, 10, 13, 3);
      body.fillStyle(0xf1d4c0, 1);
      body.fillCircle(0, -6, 5);
      body.fillStyle(0xf3e6d6, 1);
      body.fillRect(-5, -11, 10, 3);
      body.fillStyle(0xadcfe5, 1);
      body.fillCircle(7, 3, 5);
      body.lineStyle(2, 0xf3f8fb, 1);
      body.lineBetween(-7, -1, -10, 10);
    }

    container.add([shadow, body]);

    return {
      kind,
      view: container,
      target: this.chooseTarget(kind),
      speed: kind === 'worker' ? Phaser.Math.Between(30, 46) : Phaser.Math.Between(44, 58),
      pauseMs: Phaser.Math.Between(0, 800),
      phase: Phaser.Math.FloatBetween(0, Math.PI * 2),
    };
  }

  private chooseTarget(kind: UnitKind): Phaser.Math.Vector2 {
    const builtCells = this.state.entries().filter((cell) => cell.kind !== 'road');

    if (kind === 'worker' && builtCells.length > 0 && Math.random() < 0.82) {
      const target = Phaser.Utils.Array.GetRandom(builtCells);
      return new Phaser.Math.Vector2(
        target.x * TILE_SIZE + TILE_SIZE / 2 + Phaser.Math.Between(-18, 18),
        target.y * TILE_SIZE + TILE_SIZE / 2 + Phaser.Math.Between(-18, 18),
      );
    }

    const centerX = WORLD_WIDTH / 2;
    const centerY = WORLD_HEIGHT / 2;
    const radius = kind === 'soldier' ? 170 : 220;
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const distance = Phaser.Math.Between(40, radius);

    return new Phaser.Math.Vector2(
      Phaser.Math.Clamp(centerX + Math.cos(angle) * distance, 30, WORLD_WIDTH - 30),
      Phaser.Math.Clamp(centerY + Math.sin(angle) * distance, 30, WORLD_HEIGHT - 30),
    );
  }
}
