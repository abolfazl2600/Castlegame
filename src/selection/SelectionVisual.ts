import * as THREE from 'three';

export interface SelectionGridPoint {
  x: number;
  y: number;
}

/**
 * Lightweight world-space selection feedback.
 *
 * It intentionally uses a handful of basic meshes instead of post-processing
 * outlines so selection remains inexpensive on mid-range mobile GPUs.
 */
export class SelectionVisual {
  readonly layer = new THREE.Group();

  constructor(
    private readonly tileSize: number,
    private readonly gridToWorld: (x: number, y: number) => { x: number; z: number },
    private readonly elevationAt: (x: number, y: number) => number,
  ) {
    this.layer.name = 'selection-visual';
  }

  clear(): void {
    this.layer.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material?.dispose();
    });
    this.layer.clear();
  }

  show(points: readonly SelectionGridPoint[], planMode: boolean): void {
    this.clear();
    if (!points.length) return;

    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const minWorld = this.gridToWorld(minX, minY);
    const maxWorld = this.gridToWorld(maxX, maxY);
    const centerX = (minWorld.x + maxWorld.x) / 2;
    const centerZ = (minWorld.z + maxWorld.z) / 2;
    const width = (maxX - minX + 1) * this.tileSize + this.tileSize * 0.16;
    const depth = (maxY - minY + 1) * this.tileSize + this.tileSize * 0.16;
    const elevation = Math.max(...points.map((point) => this.elevationAt(point.x, point.y)));
    const y = planMode ? 10.52 : elevation + 2.38;
    const edge = Math.max(0.12, this.tileSize * 0.045);

    const fillMaterial = new THREE.MeshBasicMaterial({
      color: 0x5de4ff,
      transparent: true,
      opacity: planMode ? 0.12 : 0.09,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), fillMaterial);
    fill.rotation.x = -Math.PI / 2;
    fill.position.set(centerX, y, centerZ);
    fill.renderOrder = 150;
    this.layer.add(fill);

    const edgeMaterial = new THREE.MeshBasicMaterial({
      color: 0x75ebff,
      transparent: true,
      opacity: 0.96,
      depthTest: false,
      depthWrite: false,
    });
    const addEdge = (w: number, d: number, x: number, z: number): void => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.065, d), edgeMaterial.clone());
      mesh.position.set(x, y + 0.025, z);
      mesh.renderOrder = 151;
      this.layer.add(mesh);
    };

    addEdge(width, edge, centerX, centerZ - depth / 2);
    addEdge(width, edge, centerX, centerZ + depth / 2);
    addEdge(edge, depth, centerX - width / 2, centerZ);
    addEdge(edge, depth, centerX + width / 2, centerZ);
  }
}
