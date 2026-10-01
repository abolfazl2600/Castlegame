import fs from 'node:fs';
import assert from 'node:assert/strict';

const budgetPath = new URL('../src/rendering/DistanceDetailBudget.ts', import.meta.url);
const gamePath = new URL('../src/ThreeGame.ts', import.meta.url);
const ambientPath = new URL('../src/rendering/AmbientMotionSystem.ts', import.meta.url);

const budget = fs.readFileSync(budgetPath, 'utf8');
const game = fs.readFileSync(gamePath, 'utf8');
const ambient = fs.readFileSync(ambientPath, 'utf8');

for (const band of ['inspection', 'gameplay', 'strategic']) {
  assert.match(budget, new RegExp(`\\b${band}: \\{`), `missing ${band} distance budget`);
}

assert.match(budget, /BAND_HYSTERESIS\s*=\s*4/, 'distance bands must use hysteresis');
assert.match(budget, /maximumStrategic/, 'strategic distance must use the shared camera contract');
assert.match(budget, /shadowCasters:\s*84/, 'desktop strategic shadow budget changed unexpectedly');
assert.match(budget, /shadowCasters:\s*36/, 'mobile strategic shadow budget changed unexpectedly');
assert.match(budget, /pixelRatioScale:\s*0\.78/, 'desktop strategic raster scale changed unexpectedly');
assert.match(budget, /pixelRatioScale:\s*0\.62/, 'mobile strategic raster scale changed unexpectedly');
assert.match(budget, /parentHasReadabilityPriority/, 'silhouette/readability shadow priority is required');
assert.match(budget, /invalidate\(\): void/, 'scene redraws must be able to invalidate the active budget');
assert.match(budget, /isSuppressibleMicroDetail/, 'distance governor must classify suppressible micro-detail explicitly');
assert.match(budget, /parentHasReadabilityPriority/, 'silhouette-defining geometry must be protected from suppression');
assert.match(budget, /const preservesSilhouette =/, 'rooted silhouette meshes must be identified explicitly');
assert.match(budget, /if \\(preservesSilhouette\\) \\{[\\s\\S]*?retainedCoreMeshes \\+= 1;[\\s\\S]*?\\} else if \\(retainedCoreMeshes < perRootCore\\)/, 'silhouette meshes must survive while consuming the normal per-root core allowance');
assert.match(budget, /candidate\.mesh\.visible = false/, 'micro-detail budget must actively suppress excess detail');
assert.match(budget, /activeHighDetailMeshes/, 'active high-detail mesh diagnostics are required');
assert.match(budget, /estimatedDrawCalls/, 'estimated draw-call diagnostics are required');
assert.match(budget, /detailDrawAllowance/, 'detail draw allowance must keep normal and strategic LOD budgets distinct');
assert.match(budget, /detailBudgetRoot/, 'distance governor must budget detail per logical structure or unit root');
assert.match(budget, /current\.userData\.cellKey/, 'building roots must participate in per-structure LOD budgeting');
assert.match(budget, /current\.userData\.visualRefs/, 'battle unit roots must participate in per-unit LOD budgeting');
assert.match(budget, /previousFrameOverBudget/, 'dynamic scene growth must trigger budget reapplication when renderer calls exceed the active cap');
assert.match(budget, /GAME_MEMORY_BUDGET_BYTES\s*=\s*2 \* 1024 \* 1024 \* 1024/, 'runtime JS memory budget must be fixed at 2 GiB');
assert.match(budget, /resolveMemoryPressure/, 'memory pressure must be detected before the 2 GiB ceiling is reached');
assert.match(budget, /memoryAdjustedBudget/, 'memory pressure must reduce rendering work before the hard ceiling');
assert.match(budget, /shouldSuppressDetail/, 'LOD suppression must be gated instead of always hiding visual geometry');
assert.match(budget, /band === 'strategic'/, 'strategic view must still enable distance-based simplification');
assert.match(budget, /pressure !== 'normal'/, 'memory pressure must be able to activate detail reduction');
assert.match(budget, /detailSuppressionActive/, 'runtime diagnostics must expose whether geometry suppression is active');

assert.match(game, /DistanceDetailBudgetSystem/, 'ThreeGame must own the distance budget governor');
assert.match(game, /distanceDetailBudget\.update\(/, 'distance budget must update from the render loop');
assert.match(game, /distanceDetailBudget\.invalidate\(\)/, 'redraw must invalidate the budget for newly-created meshes');
assert.match(game, /budgetScale:\s*visualBudget\.budget\.animationScale/, 'animation budget must feed ambient motion');
assert.match(game, /visualBudget: this\.distanceDetailBudget\.snapshot\(\)/, 'visual diagnostics must expose the enforced detail budget snapshot');
assert.match(game, /adaptiveRenderProfile\.resolve\(settings\.graphics\.performanceMode\)/, 'render profile must be independent from input controls');
assert.doesNotMatch(game, /settings\.gameplay\.controlScheme === 'touch'/, 'touch controls must never select a render budget');

assert.match(ambient, /budgetScale\?: number/, 'ambient motion options must accept budget scaling');
assert.match(ambient, /options\.budgetScale \?\? 1/, 'ambient motion must apply budget scaling');

console.log('distance detail budget contract: ok');
