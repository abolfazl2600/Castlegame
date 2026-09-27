import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const [disposalSource, modernMatSource, packageJson] = await Promise.all([
  readFile(new URL('../src/rendering/WebGLDisposal.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/rendering/ModernMaterials.ts', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
]);

// 1. Verify static contracts and API exports
assert.match(disposalSource, /export function disposeHierarchy/, 'disposeHierarchy must be exported');
assert.match(disposalSource, /export function disposeGroup/, 'disposeGroup must be exported');
assert.match(disposalSource, /renderable\.geometry\.dispose\(\)/, 'geometry disposal must be invoked');
assert.match(disposalSource, /mat\.dispose\(\)/, 'material disposal must be invoked');
assert.match(disposalSource, /tex\.dispose\(\)/, 'attached texture disposal must be invoked');
assert.match(disposalSource, /isSharedMaterial/, 'shared material predicate must be supported');
assert.match(disposalSource, /isSharedGeometry/, 'shared geometry predicate must be supported');
assert.match(disposalSource, /isSharedTexture/, 'shared texture predicate must be supported');
assert.match(modernMatSource, /isSharedMaterial\(material: THREE\.Material\): boolean/, 'ModernMaterials must provide isSharedMaterial check');

// 2. Functional testing of recursive disposal and shared protection
const transpiled = ts.transpileModule(disposalSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const moduleUrl = 'data:text/javascript;base64,' + Buffer.from(transpiled).toString('base64');
const { disposeHierarchy, disposeGroup } = await import(moduleUrl);

class MockBufferGeometry {
  disposed = false;
  dispose() { this.disposed = true; }
}

class MockTexture {
  disposed = false;
  dispose() { this.disposed = true; }
}

class MockMaterial {
  disposed = false;
  map = null;
  bumpMap = null;
  normalMap = null;
  constructor(map = null, bumpMap = null, normalMap = null) {
    this.map = map;
    this.bumpMap = bumpMap;
    this.normalMap = normalMap;
  }
  dispose() { this.disposed = true; }
}

class MockMesh {
  geometry = null;
  material = null;
  children = [];
  constructor(geo, mat) {
    this.geometry = geo;
    this.material = mat;
  }
  traverse(cb) {
    cb(this);
    for (const child of this.children) child.traverse(cb);
  }
}

class MockGroup {
  children = [];
  traverse(cb) {
    cb(this);
    for (const child of this.children) child.traverse(cb);
  }
  clear() {
    this.children = [];
  }
}

// Test A: Clean disposal of unshared geometry, material, and textures
{
  const geo = new MockBufferGeometry();
  const texMap = new MockTexture();
  const texBump = new MockTexture();
  const mat = new MockMaterial(texMap, texBump);
  const mesh = new MockMesh(geo, mat);

  disposeHierarchy(mesh);
  assert.equal(geo.disposed, true, 'Unshared geometry must be disposed');
  assert.equal(mat.disposed, true, 'Unshared material must be disposed');
  assert.equal(texMap.disposed, true, 'Attached map texture must be disposed');
  assert.equal(texBump.disposed, true, 'Attached bumpMap texture must be disposed');
}

// Test B: Preservation of shared geometries, materials, and textures
{
  const sharedGeo = new MockBufferGeometry();
  const sharedMat = new MockMaterial();
  const sharedTex = new MockTexture();
  const unsharedMat = new MockMaterial(sharedTex);
  const unsharedGeo = new MockBufferGeometry();

  const mesh1 = new MockMesh(sharedGeo, sharedMat);
  const mesh2 = new MockMesh(unsharedGeo, unsharedMat);
  const group = new MockGroup();
  group.children.push(mesh1, mesh2);

  disposeGroup(group, {
    isSharedGeometry: (g) => g === sharedGeo,
    isSharedMaterial: (m) => m === sharedMat,
    isSharedTexture: (t) => t === sharedTex,
  });

  assert.equal(sharedGeo.disposed, false, 'Shared geometry must NOT be disposed');
  assert.equal(sharedMat.disposed, false, 'Shared material must NOT be disposed');
  assert.equal(sharedTex.disposed, false, 'Shared texture must NOT be disposed');
  assert.equal(unsharedGeo.disposed, true, 'Unshared geometry must be disposed');
  assert.equal(unsharedMat.disposed, true, 'Unshared material must be disposed');
  assert.equal(group.children.length, 0, 'Group children must be cleared');
}

// 3. Verify regression registration in package.json
assert.match(
  packageJson,
  /test:webgl-resource-disposal/,
  'test:webgl-resource-disposal must be registered in package.json scripts',
);

console.log('WebGL resource disposal and memory leak regression checks passed.');
