import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const game = readFileSync(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');

const treeStart = game.indexOf('private makeTree(');
const treeEnd = game.indexOf('private makeRock(', treeStart);
assert.notEqual(treeStart, -1, 'makeTree renderer must exist.');
assert.notEqual(treeEnd, -1, 'makeTree renderer boundary must exist.');
const tree = game.slice(treeStart, treeEnd);

assert.match(tree, /treeType = variant === 1 \? 'pine' : variant === 2 \? 'oak' : 'cypress'/,
  'Tree renderer must expose pine, oak, and cypress variants.');
assert.match(tree, /group\.userData\.treeVariant = treeType/,
  'Rendered trees must expose their variant for QA/debugging.');
assert.match(tree, /variant === 1[\s\S]*?ConeGeometry/,
  'Pine must keep the existing layered conifer silhouette.');
assert.match(tree, /variant === 2[\s\S]*?DodecahedronGeometry/,
  'Oak must use a broad irregular low-poly crown.');
assert.match(tree, /variant === 2[\s\S]*?CylinderGeometry[\s\S]*?rotation\.z/,
  'Oak must include visible branch structure.');
assert.match(tree, /Tall cypress[\s\S]*?\[0\.72, 2\.65, 4\.25\][\s\S]*?\[0\.38, 1\.72, 5\.95\]/,
  'Cypress must use a narrow multi-tier vertical silhouette.');
assert.match(tree, /registerSway\(crown/,
  'All tree crowns must continue to participate in ambient wind motion.');
assert.match(tree, /swayAmplitude = variant === 2 \? 0\.026 : variant === 3 \? 0\.02 : 0\.032/,
  'Each tree model should have a tuned sway amplitude.');

const placementStart = game.indexOf("if (this.selectedTool === 'tree')");
const placementEnd = game.indexOf("if (this.selectedTool === 'tower')", placementStart);
assert.notEqual(placementStart, -1, 'Tree placement path must exist.');
const placement = game.slice(placementStart, placementEnd);
assert.match(
  placement,
  /setCell\(gx, gy, 'tree', 1 \+ \(\(gx \+ gy\) % 3\)\)/,
  'Tree placement must deterministically distribute all three persisted variants.',
);

const renderDispatch = game.match(/else if \(cell\.kind === 'tree'\) this\.makeTree\(group, cell\.level \?\? 1\);/);
assert.ok(renderDispatch, 'Saved tree level must continue to drive the visual model.');

assert.doesNotMatch(tree, /new THREE\.PointLight|new THREE\.SpotLight/,
  'Tree variants must not add dynamic lights.');
assert.doesNotMatch(tree, /SphereGeometry\([^,]+,\s*(?:1[6-9]|[2-9]\d)/,
  'Tree variants must stay low-poly for mobile rendering.');

console.log('Three-model tree visual contract passed.');
