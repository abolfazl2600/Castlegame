import * as THREE from 'three';
import type { StoneStyle } from '../core/types';
import { CASTLE_ARCHITECTURE_STYLE, CASTLE_STONE_PALETTES } from './CastleArchitectureStyle';

type StoneTone = 'limestone' | 'warmGrey' | 'weathered' | 'reinforced';
export type CastleStoneRole = 'body' | 'alt' | 'dark' | 'foundation' | 'walkway';

export class MedievalMaterials {
  readonly limestone: THREE.MeshStandardMaterial;
  readonly limestoneAlt: THREE.MeshStandardMaterial;
  readonly limestoneDark: THREE.MeshStandardMaterial;
  readonly warmGrey: THREE.MeshStandardMaterial;
  readonly reinforcedStone: THREE.MeshStandardMaterial;
  readonly foundation: THREE.MeshStandardMaterial;
  readonly walkway: THREE.MeshStandardMaterial;
  readonly mortarDark: THREE.MeshStandardMaterial;
  readonly timber: THREE.MeshStandardMaterial;
  readonly timberDark: THREE.MeshStandardMaterial;
  readonly iron: THREE.MeshStandardMaterial;
  readonly roofTile: THREE.MeshStandardMaterial;
  readonly roofDark: THREE.MeshStandardMaterial;
  readonly arrowVoid: THREE.MeshStandardMaterial;
  readonly moss: THREE.MeshStandardMaterial;

  private readonly stylePalettes = new Map<
    StoneStyle,
    {
      body: THREE.MeshStandardMaterial;
      alt: THREE.MeshStandardMaterial;
      dark: THREE.MeshStandardMaterial;
      foundation: THREE.MeshStandardMaterial;
      walkway: THREE.MeshStandardMaterial;
    }
  >();
  private readonly shared = new Set<THREE.Material>();

  constructor() {
    const stoneMap = this.createStoneTexture(false);
    const stoneBump = this.createStoneTexture(true);
    const roofMap = this.createRoofTexture();

    this.limestone = this.register(
      this.stoneMaterial(CASTLE_STONE_PALETTES.limestone.body, stoneMap, stoneBump, 0.94, 0.11),
    );
    this.limestoneAlt = this.register(
      this.stoneMaterial(CASTLE_STONE_PALETTES.limestone.alt, stoneMap, stoneBump, 0.94, 0.1),
    );
    this.limestoneDark = this.register(
      this.stoneMaterial(CASTLE_STONE_PALETTES.limestone.dark, stoneMap, stoneBump, 0.98, 0.09),
    );
    this.warmGrey = this.register(
      this.stoneMaterial(0xaaa69a, stoneMap, stoneBump, 0.94, 0.15),
    );
    this.reinforcedStone = this.register(
      this.stoneMaterial(0x969c9d, stoneMap, stoneBump, 0.88, 0.14),
    );
    this.foundation = this.register(
      this.stoneMaterial(CASTLE_STONE_PALETTES.limestone.foundation, stoneMap, stoneBump, 1, 0.13),
    );
    this.walkway = this.register(
      this.stoneMaterial(CASTLE_STONE_PALETTES.limestone.walkway, stoneMap, stoneBump, 0.97, 0.07),
    );
    this.mortarDark = this.register(
      new THREE.MeshStandardMaterial({
        color: 0x312f2b,
        roughness: 1,
        metalness: 0,
      }),
    );
    this.timber = this.register(
      new THREE.MeshStandardMaterial({
        color: CASTLE_ARCHITECTURE_STYLE.palette.timber,
        roughness: 0.96,
        metalness: 0,
      }),
    );
    this.timberDark = this.register(
      new THREE.MeshStandardMaterial({
        color: CASTLE_ARCHITECTURE_STYLE.palette.timberDark,
        roughness: 1,
        metalness: 0,
      }),
    );
    this.iron = this.register(
      new THREE.MeshStandardMaterial({
        color: CASTLE_ARCHITECTURE_STYLE.palette.iron,
        roughness: 0.62,
        metalness: 0.42,
      }),
    );
    this.roofTile = this.register(
      new THREE.MeshStandardMaterial({
        color: CASTLE_ARCHITECTURE_STYLE.palette.roofTerracotta,
        map: roofMap,
        bumpMap: roofMap,
        bumpScale: 0.08,
        roughness: 0.9,
        metalness: 0,
      }),
    );
    this.roofDark = this.register(
      new THREE.MeshStandardMaterial({
        color: CASTLE_ARCHITECTURE_STYLE.palette.roofShadow,
        roughness: 0.98,
      }),
    );
    this.arrowVoid = this.register(
      new THREE.MeshStandardMaterial({
        color: CASTLE_ARCHITECTURE_STYLE.palette.opening,
        roughness: 1,
      }),
    );
    this.moss = this.register(
      new THREE.MeshStandardMaterial({
        color: CASTLE_ARCHITECTURE_STYLE.palette.moss,
        roughness: 1,
        transparent: true,
        opacity: 0.72,
      }),
    );

    this.stylePalettes.set('limestone', {
      body: this.limestone,
      alt: this.limestoneAlt,
      dark: this.limestoneDark,
      foundation: this.foundation,
      walkway: this.walkway,
    });

    this.stylePalettes.set('darkStone', this.createStylePalette('darkStone', stoneMap, stoneBump));
    this.stylePalettes.set('sandstone', this.createStylePalette('sandstone', stoneMap, stoneBump));
    this.stylePalettes.set('frontier', this.createStylePalette('frontier', stoneMap, stoneBump));
  }

  private createStylePalette(
    style: Exclude<StoneStyle, 'limestone'>,
    stoneMap: THREE.Texture,
    stoneBump: THREE.Texture,
  ): {
    body: THREE.MeshStandardMaterial;
    alt: THREE.MeshStandardMaterial;
    dark: THREE.MeshStandardMaterial;
    foundation: THREE.MeshStandardMaterial;
    walkway: THREE.MeshStandardMaterial;
  } {
    const palette = CASTLE_STONE_PALETTES[style];
    return {
      body: this.register(this.stoneMaterial(palette.body, stoneMap, stoneBump, 0.96, 0.11)),
      alt: this.register(this.stoneMaterial(palette.alt, stoneMap, stoneBump, 0.95, 0.1)),
      dark: this.register(this.stoneMaterial(palette.dark, stoneMap, stoneBump, 1, 0.12)),
      foundation: this.register(this.stoneMaterial(palette.foundation, stoneMap, stoneBump, 1, 0.14)),
      walkway: this.register(this.stoneMaterial(palette.walkway, stoneMap, stoneBump, 0.98, 0.08)),
    };
  }

  castleStone(
    style: StoneStyle,
    role: CastleStoneRole,
    x = 0,
    y = 0,
  ): THREE.MeshStandardMaterial {
    const palette = this.stylePalettes.get(style) ?? this.stylePalettes.get('limestone')!;
    if (role === 'body' && Math.abs(x * 31 + y * 19) % 5 === 0) return palette.alt;
    if (role === 'alt' && Math.abs(x * 13 + y * 23) % 4 === 0) return palette.body;
    return palette[role];
  }

  stoneVariant(x: number, y: number, tone: StoneTone = 'limestone'): THREE.MeshStandardMaterial {
    if (tone === 'warmGrey') return this.warmGrey;
    if (tone === 'reinforced') return this.reinforcedStone;
    if (tone === 'weathered') return (Math.abs(x * 17 + y * 29) % 3 === 0) ? this.limestoneAlt : this.limestoneDark;
    return (Math.abs(x * 31 + y * 19) % 4 === 0) ? this.limestoneAlt : this.limestone;
  }

  isSharedMaterial(material: THREE.Material): boolean {
    return this.shared.has(material);
  }

  private register<T extends THREE.Material>(material: T): T {
    this.shared.add(material);
    return material;
  }

  private stoneMaterial(
    color: number,
    map: THREE.Texture,
    bumpMap: THREE.Texture,
    roughness: number,
    bumpScale: number,
  ): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color,
      map,
      bumpMap,
      bumpScale,
      roughness,
      metalness: 0.01,
    });
  }

  private createStoneTexture(bumpOnly: boolean): THREE.CanvasTexture {
    const size = 384;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');

    if (context) {
      context.fillStyle = bumpOnly ? '#777' : '#9d968a';
      context.fillRect(0, 0, size, size);

      const rowHeight = 42;
      let row = 0;

      for (let y = -rowHeight; y < size + rowHeight; y += rowHeight) {
        const offset = row % 2 === 0 ? -28 : 10;
        let x = offset;
        let stoneIndex = 0;

        while (x < size + 70) {
          const hash = Math.abs(
            Math.imul(row + 17, 73856093) ^
            Math.imul(stoneIndex + 23, 19349663),
          );
          const width = 48 + (hash % 38);
          const height = rowHeight - 5 + ((hash >>> 5) % 5);
          const tone = (hash >>> 8) % 5;
          const inset = 2 + ((hash >>> 12) % 3);

          context.fillStyle = bumpOnly
            ? `rgb(${145 + tone * 7},${145 + tone * 7},${145 + tone * 7})`
            : [
                '#aaa294',
                '#b7ad9d',
                '#958d82',
                '#c0b5a3',
                '#9e9689',
              ][tone];
          context.fillRect(x + inset, y + inset, width - inset * 2, height - inset * 2);

          context.strokeStyle = bumpOnly ? '#4a4a4a' : '#5d574e';
          context.globalAlpha = bumpOnly ? 0.62 : 0.46;
          context.lineWidth = 2.5;
          context.strokeRect(x + 1, y + 1, width - 2, height - 2);

          if (!bumpOnly) {
            context.globalAlpha = 0.12;
            context.fillStyle = '#e7dcc8';
            context.fillRect(x + inset + 2, y + inset + 2, width - inset * 2 - 4, 2);

            if ((hash & 7) === 0) {
              context.globalAlpha = 0.16;
              context.fillStyle = '#5f694d';
              context.fillRect(x + width * 0.12, y + height - 7, width * 0.44, 3);
            }
          }

          x += width - 2;
          stoneIndex += 1;
        }

        row += 1;
      }

      if (!bumpOnly) {
        context.globalAlpha = 0.08;
        for (let i = 0; i < 180; i += 1) {
          const px = (i * 83) % size;
          const py = (i * 137) % size;
          const radius = 1 + (i % 3);
          context.fillStyle = i % 4 === 0 ? '#403d37' : '#d8cdbb';
          context.beginPath();
          context.arc(px, py, radius, 0, Math.PI * 2);
          context.fill();
        }
      }

      context.globalAlpha = 1;
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2.6, 2.2);
    texture.anisotropy = 4;
    return texture;
  }

  private createRoofTexture(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');

    if (context) {
      context.fillStyle = '#6d5157';
      context.fillRect(0, 0, size, size);

      for (let y = 0; y < size + 24; y += 20) {
        const offset = (y / 20) % 2 === 0 ? 0 : 12;
        for (let x = -24 + offset; x < size + 24; x += 24) {
          context.fillStyle = ((x + y) / 4) % 3 === 0 ? '#76575c' : '#61484e';
          context.fillRect(x + 1, y + 1, 22, 17);
          context.strokeStyle = '#3e3134';
          context.globalAlpha = 0.48;
          context.strokeRect(x, y, 24, 19);
        }
      }

      context.globalAlpha = 1;
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2.2, 2.2);
    texture.anisotropy = 4;
    return texture;
  }
}
