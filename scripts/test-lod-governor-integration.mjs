import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import * as THREE from 'three';

// Exercise the production TypeScript governor with a real Three.js scene.
// Bundling resolves its normal extensionless TS imports without WebGL or DOM.
const tempDir = mkdtempSync(join(process.cwd(), '.lod-budget-qa-'));
let governor;
try {
  const outfile = join(tempDir, 'governor.mjs');
  await build({
    entryPoints: ['src/rendering/DistanceDetailBudget.ts'],
    outfile,
    platform: 'node',
    format: 'esm',
    bundle: true,
    packages: 'external',
    logLevel: 'silent',
  });
  const { DistanceDetailBudgetSystem } = await import(pathToFileURL(outfile).href);
  governor = new DistanceDetailBudgetSystem();
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

const scene = new THREE.Scene();
const material = new THREE.MeshStandardMaterial({ color: 0x888888 });
const geometry = new THREE.BoxGeometry(4, 4, 4);
const protectedMeshes = [];
for (let i = 0; i < 35; i += 1) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(i * 5, 0, 0);
  mesh.castShadow = true;
  mesh.userData.distanceDetailPriority = 'silhouette';
  scene.add(mesh);
  protectedMeshes.push(mesh);
}
const castleBatch = new THREE.InstancedMesh(geometry, material, 1);
castleBatch.setMatrixAt(0, new THREE.Matrix4().makeTranslation(1, 0, 0));
castleBatch.instanceMatrix.needsUpdate = true;
castleBatch.userData.distanceDetailPriority = 'micro';
scene.add(castleBatch);
protectedMeshes.push(castleBatch);
for (let i = 0; i < 80; i += 1) {
  const detail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), material);
  detail.userData.distanceDetailPriority = 'micro';
  detail.position.set(i * 0.4, 1, 0);
  scene.add(detail);
}

let traversals = 0;
const traverse = scene.traverse.bind(scene);
scene.traverse = (visitor) => {
  traversals += 1;
  traverse(visitor);
};
const renderer = {
  info: { render: { calls: 720 } },
  shadowMap: { enabled: true },
  ratios: [],
  setPixelRatio(value) { this.ratios.push(value); },
};
const settings = {
  graphics: { quality: 'low', performanceMode: 'performance', shadowsEnabled: true },
};
let snapshot = governor.update(scene, renderer, 104, settings, 'performance');
assert.equal(snapshot.lodRecalculations, 1);
assert.equal(snapshot.overBudgetRechecks, 0);
const baselineTraversals = traversals;
assert.ok(baselineTraversals >= 2, 'first update should traverse detail and shadow candidates');
assert.ok(protectedMeshes.every(mesh => mesh.visible), 'silhouettes and instanced geometry must remain visible');

snapshot = governor.update(scene, renderer, 104, settings, 'performance');
assert.equal(snapshot.overBudgetRechecks, 1, 'the first measured overload should trigger an additional evaluation');
const settledTraversals = traversals;
for (let frame = 0; frame < 200; frame += 1) {
  snapshot = governor.update(scene, renderer, 104, settings, 'performance');
}
assert.equal(snapshot.lodRecalculations, 2, 'stable overload should not cause frame-by-frame LOD work');
assert.equal(traversals, settledTraversals, 'cached LOD must avoid all scene traversals');
assert.ok(protectedMeshes.every(mesh => mesh.visible), 'protected geometry must survive pressure');
assert.equal(renderer.ratios.length, 2, 'renderer quality should not be reset every frame');

governor.invalidate();
governor.update(scene, renderer, 104, settings, 'performance');
assert.equal(governor.snapshot().lodRecalculations, 3, 'world edit invalidation must rebuild LOD');

governor.update(scene, renderer, 104, { graphics: { ...settings.graphics, quality: 'high' } }, 'quality');
assert.equal(governor.snapshot().lodRecalculations, 4, 'quality/profile change must rebuild LOD');
assert.ok(protectedMeshes.every(mesh => mesh.visible), 'profile change must keep protected geometry');

const overlaySource = readFileSync('src/debug/PerformanceDebugOverlay.ts', 'utf8');
assert.match(overlaySource, /'LOD scene recalculations'/);
assert.match(overlaySource, /'Over-budget LOD retries'/);
console.log(`Dense synthetic scene: ${protectedMeshes.length} protected drawables and 80 micro meshes.`);
console.log(`200 unchanged overloaded frames: 0 extra traversals; governor total passes: ${snapshot.lodRecalculations}.`);
console.log('Live Three.js LOD integration, protected geometry and invalidation checks: ok');
