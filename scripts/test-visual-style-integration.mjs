import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const threeGame = await readFile(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const templateStyle = await readFile(new URL('../src/rendering/TemplateVisualStyle.ts', import.meta.url), 'utf8');
const modernStyle = await readFile(new URL('../src/rendering/ModernStyle.ts', import.meta.url), 'utf8');
const modernMaterials = await readFile(new URL('../src/rendering/ModernMaterials.ts', import.meta.url), 'utf8');
const futuristicRenderer = await readFile(new URL('../src/rendering/FuturisticCastleRenderer.ts', import.meta.url), 'utf8');

const templateIds = [...html.matchAll(/data-template="([^"]+)"/g)].map((match) => match[1]);
assert.equal(templateIds.length, 32, 'Template picker should expose the current 32 complete starting worlds.');
assert.equal(new Set(templateIds).size, templateIds.length, 'Complete template IDs must be unique.');

for (const id of templateIds) {
  assert.equal(
    templateStyle.split(`'${id}':`).length - 1,
    1,
    `Complete template ${id} must have exactly one explicit visual preset.`,
  );
}

for (const stoneStyle of ['limestone', 'darkStone', 'sandstone', 'frontier']) {
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
  /this\.stoneStyle = '(?:limestone|darkStone|sandstone|frontier)'/,
  'Template branches must not bypass the shared visual preset with one-off stone assignments.',
);
assert.doesNotMatch(
  applyTemplate,
  /this\.towerBridgeKind = '(?:stone|wood)'/,
  'Template branches must not leak one-off bridge defaults between starting worlds.',
);

assert.match(modernMaterials, /import \{ MODERN_STYLE \} from '\.\/ModernStyle';/);
assert.match(modernMaterials, /const \{ palette, material \} = MODERN_STYLE;/);
assert.doesNotMatch(
  modernMaterials,
  /(?:color|emissive):\s*0x[0-9a-f]+/i,
  'ModernMaterials should consume shared style tokens instead of raw palette literals.',
);
assert.match(modernStyle, /reinforcedConcrete:/);
assert.match(modernStyle, /structuralSteel:/);
assert.match(modernStyle, /securityLight:/);
assert.match(modernStyle, /warningStripe:/);
assert.doesNotMatch(
  modernStyle,
  /(?:roofTerracotta|plaster|timberFraming|landmarkPurple)\s*:/,
  'Modern style tokens must remain separate from medieval surface motifs.',
);
assert.match(
  futuristicRenderer,
  /const warning = materials\.warningStripe;/,
  'Modern Fortress warning details must use the dedicated modern accent role.',
);

console.log('Visual style integration regression checks passed.');
