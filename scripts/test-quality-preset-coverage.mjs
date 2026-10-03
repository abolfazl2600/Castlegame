import assert from 'node:assert/strict';
import fs from 'node:fs';
import { graphicsQualityPreset } from '../src/rendering/GraphicsQualityPreset.ts';

const low = graphicsQualityPreset('low');
const medium = graphicsQualityPreset('medium');
const high = graphicsQualityPreset('high');

assert.ok(low.resolutionScale < medium.resolutionScale);
assert.ok(medium.resolutionScale < high.resolutionScale);
assert.equal(low.allowDynamicShadows, false);
assert.equal(high.allowDynamicShadows, true);
assert.ok(low.shadowBudgetScale < medium.shadowBudgetScale);
assert.ok(medium.shadowBudgetScale <= high.shadowBudgetScale);
assert.ok(low.particleBudgetScale < medium.particleBudgetScale);
assert.ok(medium.particleBudgetScale < high.particleBudgetScale);
assert.ok(low.animationBudgetScale < medium.animationBudgetScale);
assert.ok(medium.animationBudgetScale < high.animationBudgetScale);
assert.ok(low.microDetailBudgetScale < medium.microDetailBudgetScale);
assert.ok(medium.microDetailBudgetScale < high.microDetailBudgetScale);
assert.ok(low.foliageDetailScale < medium.foliageDetailScale);
assert.ok(medium.foliageDetailScale < high.foliageDetailScale);
assert.ok(low.npcPresentationScale < medium.npcPresentationScale);
assert.ok(medium.npcPresentationScale < high.npcPresentationScale);

assert.equal(low.battle.decorativeEffectsEnabled, false);
assert.equal(low.battle.missileTrailParticleCap, 0);
assert.ok(medium.battle.missileTrailParticleCap < high.battle.missileTrailParticleCap);
assert.ok(medium.battle.missileExplosionEffectCap < high.battle.missileExplosionEffectCap);
assert.ok(medium.battle.impactEffectCap < high.battle.impactEffectCap);
assert.ok(medium.battle.wallCollapseEffectCap < high.battle.wallCollapseEffectCap);

const settingsSubsystems = fs.readFileSync(new URL('../src/settings/SettingsSubsystems.ts', import.meta.url), 'utf8');
const detailBudget = fs.readFileSync(new URL('../src/rendering/DistanceDetailBudget.ts', import.meta.url), 'utf8');
const battleSystem = fs.readFileSync(new URL('../src/battle/BattleSystem.ts', import.meta.url), 'utf8');
const game = fs.readFileSync(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');

assert.match(settingsSubsystems, /graphicsQualityPreset\(settings\.graphics\.quality\)/);
assert.match(detailBudget, /qualityAdjustedBudget\(profileBudget, settings\)/);
assert.match(detailBudget, /preset\.particleBudgetScale/);
assert.match(detailBudget, /preset\.microDetailBudgetScale/);
assert.match(battleSystem, /presentationBudget\?\.\(\)\.missileTrailParticleCap/);
assert.match(battleSystem, /presentationBudget\?\.\(\)\.missileExplosionEffectCap/);
assert.match(battleSystem, /presentationBudget\?\.\(\)\.impactEffectCap/);
assert.match(battleSystem, /presentationBudget\?\.\(\)\.wallCollapseEffectCap/);
assert.match(game, /presentationBudget: \(\) => graphicsQualityPreset/);

// Core arrows and missiles are gameplay-bearing projectiles. Their simulation
// arrays must not be truncated by a graphics preset.
assert.doesNotMatch(battleSystem, /while \(this\.arrows\.length >/);
assert.doesNotMatch(battleSystem, /while \(this\.missiles\.length >/);

console.log('quality preset coverage contract: ok');
