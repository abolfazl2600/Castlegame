import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const threeGame = await readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const templateStyle = await readFile(new URL('../src/rendering/TemplateVisualStyle.ts', import.meta.url), 'utf8');

const templateIds = [...html.matchAll(/data-template="([^"]+)"/g)].map((match) => match[1]);
assert.equal(templateIds.length, 33, 'Template picker should expose the current 33 complete starting worlds.');
assert.equal(new Set(templateIds).size, templateIds.length, 'Complete template IDs must be unique.');

for (const id of templateIds) {
  assert.equal(
    templateStyle.split(`'${id}':`).length - 1,
    1,
    `Complete template ${id} must have exactly one explicit visual preset.`,
  );
}

for (const stoneStyle of ['limestone', 'darkStone', 'sandstone', 'frontier', 'earthen']) {
  assert.match(
    templateStyle,
    new RegExp(`stoneStyle: '${stoneStyle}'`),
    `Template presets must continue to exercise the shared ${stoneStyle} stone family.`,
  );
}

const applyTemplateStart = threeGame.indexOf('private applyTemplate(template: string): void {');
const applyTerrainStart = threeGame.indexOf('private applyTerrainTemplate(', applyTemplateStart);
assert.notEqual(applyTemplateStart, -1, 'applyTemplate must exist.');
assert.notEqual(applyTerrainStart, -1, 'applyTerrainTemplate boundary must exist.');
const applyTemplate = threeGame.slice(applyTemplateStart, applyTerrainStart);

assert.match(
  applyTemplate,
  /const visualPreset = getTemplateVisualPreset\(template\);/,
  'Complete templates must resolve their visual family through the shared registry.',
);
assert.match(
  applyTemplate,
  /this\.stoneStyle = visualPreset\.stoneStyle;[\s\S]*?this\.towerBridgeKind = visualPreset\.towerBridgeKind;/,
  'Template style and bridge defaults must be restored before authored placement runs.',
);
assert.doesNotMatch(
  applyTemplate,
  /this\.stoneStyle = '(?:limestone|darkStone|sandstone|frontier|whitePlaster|earthen)'/,
  'Template branches must not bypass the shared visual preset with one-off stone assignments.',
);
assert.doesNotMatch(
  applyTemplate,
  /this\.towerBridgeKind = '(?:stone|wood)'/,
  'Template branches must not leak one-off bridge defaults between starting worlds.',
);

console.log('Visual style integration regression checks passed.');
