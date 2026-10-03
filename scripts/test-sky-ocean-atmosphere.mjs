import fs from 'node:fs';
import assert from 'node:assert/strict';

const game = fs.readFileSync(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const environment = fs.readFileSync(new URL('../src/systems/EnvironmentSystem.ts', import.meta.url), 'utf8');

for (const field of ['horizon', 'deepWater', 'shallowWater']) {
  assert.match(environment, new RegExp(`\\b${field}: number`), `season visual state must expose ${field}`);
  assert.match(environment, new RegExp(`${field}: lerpColor\\(a\\.${field}, b\\.${field}, t\\)`),
    `${field} must transition smoothly with seasons`);
}

assert.match(game, /private readonly skyTexture: THREE\.CanvasTexture/);
assert.match(game, /private createSkyTexture\(\): THREE\.CanvasTexture/);
assert.match(game, /private updateSkyTexture\(/);
assert.match(game, /this\.scene\.background = this\.skyTexture/);
assert.doesNotMatch(game, /this\.scene\.background = new THREE\.Color\(WORLD_STYLE\.lighting\.fog\)/,
  'the world background must no longer be a flat color');

const skyStart = game.indexOf('private atmospherePaletteKey');
const riverStart = game.indexOf('private createRiverTexture');
assert.ok(skyStart >= 0 && riverStart > skyStart, 'sky atmosphere methods must be present before water textures');
const skyBlock = game.slice(skyStart, riverStart);
assert.match(skyBlock, /createLinearGradient/);
assert.match(skyBlock, /state\.horizon/);
assert.match(skyBlock, /state\.fog/);
assert.match(skyBlock, /ClampToEdgeWrapping/);
assert.match(skyBlock, /LinearFilter/);
assert.doesNotMatch(skyBlock, /ShaderMaterial|WebGLRenderTarget|CubeCamera/,
  'sky depth must stay lightweight and avoid expensive reflection/post-processing paths');

assert.match(game, /new THREE\.CircleGeometry\(MAX_WORLD_SPAN \* 3, 160\)/,
  'deep ocean must extend beyond the largest supported rectangular world at maximum zoom-out');
assert.match(game, /this\.ambientMotion\.registerTextureFlow\(this\.oceanTexture/,
  'ocean motion must reuse the existing lightweight texture-flow system');
assert.match(game, /this\.oceanWaterMaterial\.color\.lerp\(deepWater, blend\)/);
assert.match(game, /this\.shallowWaterMaterial\.color\.lerp\(shallowWater, blend\)/);
assert.match(game, /this\.riverWaterMaterial\.color\.lerp/);

const oceanStart = game.indexOf('private createOceanTexture');
const lightsStart = game.indexOf('private addLights');
assert.ok(oceanStart >= 0 && lightsStart > oceanStart);
const oceanBlock = game.slice(oceanStart, lightsStart);
assert.match(oceanBlock, /canvas\.width = 256/);
assert.match(oceanBlock, /canvas\.height = 256/);
assert.doesNotMatch(oceanBlock, /WebGLRenderTarget|CubeCamera/,
  'ocean improvements must not add expensive render targets or real-time reflections');

console.log('sky/ocean atmosphere contract passed.');
