import Phaser from 'phaser';
import {
  CAMERA_MAX_ZOOM,
  CAMERA_MIN_ZOOM,
  CAMERA_PAN_SPEED,
  CAMERA_ZOOM_STEP,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../core/constants';

export class CameraController {
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly keys: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private dragAnchor: { pointerX: number; pointerY: number; scrollX: number; scrollY: number } | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is not available');

    this.cursors = keyboard.createCursorKeys();
    this.keys = keyboard.addKeys('W,A,S,D') as Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;

    const camera = scene.cameras.main;
    camera.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    camera.setZoom(1);
    camera.centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);

    scene.input.on('wheel', (pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
      const before = pointer.positionToCamera(camera) as Phaser.Math.Vector2;
      const nextZoom = Phaser.Math.Clamp(
        camera.zoom - Math.sign(dy) * CAMERA_ZOOM_STEP,
        CAMERA_MIN_ZOOM,
        CAMERA_MAX_ZOOM,
      );
      camera.setZoom(nextZoom);
      const after = pointer.positionToCamera(camera) as Phaser.Math.Vector2;
      camera.scrollX += before.x - after.x;
      camera.scrollY += before.y - after.y;
    });

    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonDown() || pointer.rightButtonDown()) {
        this.dragAnchor = {
          pointerX: pointer.x,
          pointerY: pointer.y,
          scrollX: camera.scrollX,
          scrollY: camera.scrollY,
        };
      }
    });

    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragAnchor) return;
      camera.scrollX = this.dragAnchor.scrollX - (pointer.x - this.dragAnchor.pointerX) / camera.zoom;
      camera.scrollY = this.dragAnchor.scrollY - (pointer.y - this.dragAnchor.pointerY) / camera.zoom;
    });

    scene.input.on('pointerup', () => {
      this.dragAnchor = null;
    });

    scene.input.mouse?.disableContextMenu();
  }

  update(deltaMs: number): void {
    const camera = this.scene.cameras.main;
    const distance = (CAMERA_PAN_SPEED * deltaMs) / 1000 / camera.zoom;

    if (this.cursors.left.isDown || this.keys.A.isDown) camera.scrollX -= distance;
    if (this.cursors.right.isDown || this.keys.D.isDown) camera.scrollX += distance;
    if (this.cursors.up.isDown || this.keys.W.isDown) camera.scrollY -= distance;
    if (this.cursors.down.isDown || this.keys.S.isDown) camera.scrollY += distance;
  }

  isDragging(): boolean {
    return this.dragAnchor !== null;
  }
}
