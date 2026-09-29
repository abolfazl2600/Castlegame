import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const [gameMode, types, game, html, templates, visualScene] = await Promise.all([
  readFile(new URL('../src/core/GameMode.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/types.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/rendering/TemplateVisualStyle.ts', import.meta.url), 'utf8'),
  readFile(new URL('./visual-reference-scene.mjs', import.meta.url), 'utf8'),
]);

assert.doesNotMatch(gameMode, /["']modern["']|futuristicCastle|Modern Fortress/);
assert.doesNotMatch(types, /futuristicCastle/);
assert.doesNotMatch(game, /FuturisticCastleRenderer|futuristicCastle|futuristic-castle|Modern Fortress/);
assert.doesNotMatch(html, /data-game-mode="modern"|data-template="futuristic-castle"|>Modern Fortress<|>Futuristic Castle</);
assert.doesNotMatch(templates, /family:\s*'modern'|futuristic-castle/);
assert.doesNotMatch(visualScene, /mode:\s*'modern'|futuristicCastle|modernCells/);

for (const relativePath of [
  '../src/rendering/FuturisticCastleRenderer.ts',
  '../src/rendering/ModernArchitecture.ts',
  '../src/rendering/ModernMaterials.ts',
  '../src/rendering/ModernStyle.ts',
]) {
  let exists = true;
  try {
    await access(new URL(relativePath, import.meta.url));
  } catch {
    exists = false;
  }
  assert.equal(exists, false, `${relativePath} must stay removed`);
}

console.log('modern mode removal regression checks passed');
