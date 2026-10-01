import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes, registerHooks } from 'node:module';
import { runInNewContext } from 'node:vm';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
registerHooks({
  resolve(specifier, context, next) {
    try { return next(specifier, context); }
    catch (error) { if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(specifier + '.ts', context); throw error; }
  },
  load(url, context, next) {
    if (url.endsWith('.ts')) return { format: 'module', shortCircuit: true,
      source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform' }) };
    return next(url, context);
  },
});
const { TouchGestureSession } = await import('../src/input/TouchGestureSession.ts');
const { applyTouchCameraDelta } = await import('../src/input/TouchCamera.ts');
const point = (pointerId, clientX, clientY = 200) => ({ pointerId, clientX, clientY });
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('ok: ' + name); };

check('native PointerEvent prototype getters produce finite pinch baselines', () => {
  const nativePoint = (id, x) => Object.create({ get pointerId() { return id; },
    get clientX() { return x; }, get clientY() { return 200; } });
  const deltas = [];
  const session = new TouchGestureSession(() => {}, d => deltas.push(d));
  session.down(nativePoint(1, 100), 'stroke'); session.down(nativePoint(2, 200), 'stroke');
  session.move(nativePoint(1, 90)); session.move(nativePoint(2, 210));
  assert.ok(deltas.every(d => Number.isFinite(d.dx) && Number.isFinite(d.dy) && Number.isFinite(d.scale)));
  assert.equal(deltas[0].scale, 1.1);
  assert.equal(session.up(nativePoint(1, 90)), false);
  assert.equal(session.up(nativePoint(2, 210)), false);
});

check('whole-sequence suppression and stable 1→2→3→2→1 transitions', () => {
  const deltas = []; let cancellations = 0;
  const session = new TouchGestureSession(() => cancellations++, d => deltas.push(d));
  assert.equal(session.down(point(1, 100), 'stroke'), true);
  assert.equal(session.move(point(1, 130), 'stroke'), true);
  assert.equal(session.down(point(2, 230), 'stroke'), false);
  assert.equal(deltas.length, 0);
  session.move(point(2, 250));
  assert.deepEqual(deltas.at(-1), { fingers: 2, dx: 10, dy: 0, scale: 1.2 });
  session.down(point(3, 600), 'stroke');
  const count = deltas.length;
  session.move(point(3, 900)); assert.equal(deltas.length, count);
  assert.equal(session.up(point(3, 900)), false);
  session.move(point(2, 250));
  assert.deepEqual(deltas.at(-1), { fingers: 2, dx: 0, dy: 0, scale: 1 });
  assert.equal(session.up(point(2, 250)), false);
  session.move(point(1, 130));
  assert.deepEqual(deltas.at(-1), { fingers: 1, dx: 0, dy: 0, scale: 1 });
  assert.equal(session.up(point(1, 130)), false);
  assert.ok(cancellations > 0);
  assert.equal(session.down(point(4, 100), 'tap'), true);
  assert.equal(session.up(point(4, 100)), true);
});
check('maximum movement wins even when a finger returns to the tap origin', () => {
  let cancelled = 0;
  const session = new TouchGestureSession(() => cancelled++, () => {});
  session.down(point(1, 100), 'tap'); session.move(point(1, 120)); session.move(point(1, 100));
  assert.equal(session.up(point(1, 100)), false); assert.equal(cancelled, 1);
  session.down(point(1, 100), 'tap');
  assert.equal(session.up(point(1, 110)), false); // missing final move event
});
check('interruption quarantines late releases and allows a fresh session', () => {
  const session = new TouchGestureSession(() => {}, () => {});
  session.down(point(1, 100), 'stroke'); session.interrupt();
  assert.equal(session.up(point(1, 100)), false);
  assert.equal(session.move(point(1, 150)), false);
  assert.equal(session.down(point(2, 100), 'tap'), true);
  assert.equal(session.up(point(2, 100)), true);
});
check('capture loss cancels the full action and suppresses remaining finger releases', () => {
  let cancelled = 0;
  const session = new TouchGestureSession(() => cancelled++, () => {});
  session.down(point(1, 100), 'stroke'); session.down(point(2, 200), 'tap');
  session.cancel(2); assert.equal(session.up(point(1, 100)), false); assert.equal(cancelled, 2);
});
check('coincident pinch fingers remain finite; blocked transitions cannot reenable controls', () => {
  const deltas = [];
  const session = new TouchGestureSession(() => {}, d => deltas.push(d));
  session.down(point(1, 100), 'tap'); session.down(point(2, 100), 'tap');
  session.move(point(2, 150)); assert.equal(deltas[0].scale, 1);
  const blocked = new TouchGestureSession(() => assert.fail('blocked action must not cancel a camera transition'), () => assert.fail('blocked camera'));
  blocked.down(point(1, 100), 'blocked'); blocked.down(point(2, 200), 'tap'); blocked.move(point(2, 300)); blocked.cancel(2); blocked.interrupt();
});

// Execute the actual ThreeGame event integration, with real Three.js camera and
// OrbitControls. Only rendering/world services are substituted; listeners and
// gesture routing are the production methods, not copies of the algorithm.
const source = readFileSync(new URL('../src/ThreeGame.ts', import.meta.url), 'utf8');
const names = ['bindPointerInput', 'cancelActiveTouchBuildGesture'];
const methods = names.map(name => {
  const start = source.indexOf('  private ' + name + '(');
  const end = source.indexOf('\n  private ', start + 1);
  assert.ok(start >= 0 && end > start, name); return source.slice(start, end);
}).join('\n');
class Surface {
  listeners = new Map(); style = {}; captured = new Set(); clientHeight = 400; clientWidth = 800;
  addEventListener(type, fn, options) { const list = this.listeners.get(type) ?? []; list.push({ fn, capture: options === true || options?.capture }); this.listeners.set(type, list); }
  removeEventListener(type, fn) { this.listeners.set(type, (this.listeners.get(type) ?? []).filter(x => x.fn !== fn)); }
  getRootNode() { return this.document; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 400 }; }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { if (this.captured.delete(id)) this.fire('lostpointercapture', point(id, 0)); }
  fire(type, values = {}) {
    const event = { type, target: this, button: 0, pointerType: 'touch', shiftKey: false,
      ...values, preventDefault() {}, stopPropagation() { this.stopped = true; } };
    if (this.document && type === 'pointerdown') this.document.fire(type, { ...values, target: this });
    for (const capture of [true, false]) {
      if (!capture && event.stopped) break;
      for (const { fn, capture: captured } of [...(this.listeners.get(type) ?? [])]) if (!!captured === capture) fn(event);
    }
    return event;
  }
}
function harness(tool = null, { battle = false, god = false, native = false } = {}) {
  const document = new Surface(); document.getElementById = () => null;
  const window = new Surface(); window.location = { search: '' };
  const canvas = new Surface(); canvas.document = document;
  const camera = new THREE.PerspectiveCamera(45, 2, 0.1, 1000); camera.position.set(0, 80, 100);
  const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.minDistance = 20; controls.maxDistance = 200; controls.maxPolarAngle = Math.PI / 2.2;
  let appState;
  const Runtime = runInNewContext(stripTypeScriptTypes('class Runtime {\n' + methods + '\n}\nRuntime;', { mode: 'transform' }), {
    document, window, URLSearchParams, TouchGestureSession, applyTouchCameraDelta,
    Capacitor: { isNativePlatform: () => native }, App: { addListener: (_name, fn) => { appState = fn; return Promise.resolve({ remove() {} }); } },
  });
  const runtime = new Runtime();
  Object.assign(runtime, {
    renderer: { domElement: canvas }, camera, controls, battleSystem: { isActive: () => battle }, selectedTool: tool,
    wallPreviewLayer: {}, terrainStrokeSnapshot: null, terrainStrokeChanged: false, terrainStrokeActive: false,
    elevationOverrides: new Map(), pointerStart: null, godModeTouchStart: null, longPressTriggered: false,
    cancelLongPress() { this.longPress = false; }, beginLongPress() { this.longPress = true; },
    cancelLongPressOnMovement() {}, pickGridCell: e => ({ x: Math.floor(e.clientX / 10), y: Math.floor(e.clientY / 10) }),
    isGodModeTargeting: () => god, isWallTool: t => t === 'wall1', isRoadTool: t => t === 'road', isTerrainTool: t => t === 'raise',
    wallPath: (a,b) => [a,b], roadPath: (a,b) => [a,b], mountainRangePath: (a,b) => [a,b],
    renderBuildPlacementPreview() { this.preview = true; }, clearBuildPlacementPreview() { this.preview = false; },
    clearGroup() {}, renderWallPreview() {}, renderRoadPreview() {}, renderMountainRangePreview() {},
    key: (x, y) => x + ',' + y, setStatus() {}, enforceGameplayCameraBounds() {},
    captureSnapshot() { return { elevations: [...this.elevationOverrides] }; },
    applyTerrainBrush(cell) { this.terrainStrokeChanged = true; this.elevationOverrides.set(this.key(cell.x, cell.y), 1); },
    normalizeRiverElevations() {}, redraw() {}, pushUndoSnapshot() { this.undo = (this.undo ?? 0) + 1; },
    scheduleSave() { this.saves = (this.saves ?? 0) + 1; },
    handleBuildClick() { this.builds = (this.builds ?? 0) + 1; },
    buildWallDrag() { this.builds = (this.builds ?? 0) + 1; },
    buildRoadDrag() { this.builds = (this.builds ?? 0) + 1; },
    buildMountainRange() { this.builds = (this.builds ?? 0) + 1; },
    setGodModeTarget() { this.targets = (this.targets ?? 0) + 1; },
    audioManager: { initializeFromUserGesture: () => Promise.resolve(true) },
  });
  runtime.bindPointerInput();
  return { runtime, camera, controls, canvas, window, document, nativePause: () => appState({ isActive: false }) };
}
const touch = (h, type, id, x, y = 200) => h.canvas.fire(type, point(id, x, y));
for (const tool of ['wall1', 'road', 'raise', 'mountainRange', null]) {
  check(`${tool ?? 'tap'} → pinch cancels world action, zooms, and starts fresh`, () => {
    const h = harness(tool); touch(h, 'pointerdown', 1, 100); touch(h, 'pointermove', 1, 120);
    const before = h.camera.position.distanceTo(h.controls.target);
    touch(h, 'pointerdown', 2, 220); assert.equal(h.runtime.longPress, false);
    touch(h, 'pointermove', 2, 280);
    assert.ok(h.camera.position.distanceTo(h.controls.target) < before);
    assert.equal(h.controls._pointers.length, 0, 'OrbitControls must not see a partial touch stream');
    touch(h, 'pointerup', 2, 280); touch(h, 'pointerup', 1, 120);
    assert.equal(h.runtime.builds ?? 0, 0); assert.equal(h.runtime.elevationOverrides.size, 0);
    assert.equal(h.canvas.captured.size, 0); assert.equal(h.controls.enabled, true);
    touch(h, 'pointerdown', 3, 100); touch(h, 'pointerup', 3, 100);
    if (tool === 'raise') assert.equal(h.runtime.undo, 1); else assert.equal(h.runtime.builds, 1);
  });
}
for (const interruption of ['pointercancel', 'lostpointercapture', 'blur', 'pagehide', 'visibility', 'UI', 'native']) {
  check(`terrain rollback on ${interruption} with no history/save mutation`, () => {
    const h = harness('raise', { native: true }); h.runtime.elevationOverrides.set('old', 2);
    touch(h, 'pointerdown', 1, 100); assert.equal(h.runtime.elevationOverrides.size, 2);
    if (interruption === 'pointercancel') touch(h, 'pointercancel', 1, 100);
    else if (interruption === 'lostpointercapture') h.canvas.releasePointerCapture(1);
    else if (interruption === 'visibility') { h.document.hidden = true; h.document.fire('visibilitychange'); }
    else if (interruption === 'UI') h.document.fire('pointerdown', { target: {} });
    else if (interruption === 'native') h.nativePause();
    else h.window.fire(interruption);
    touch(h, 'pointerup', 1, 100);
    assert.deepEqual([...h.runtime.elevationOverrides], [['old', 2]]);
    assert.equal(h.runtime.undo ?? 0, 0); assert.equal(h.runtime.saves ?? 0, 0);
    assert.equal(h.runtime.terrainStrokeActive, false); assert.equal(h.runtime.pointerStart, null);
  });
}
check('single stroke commits once, normal capture release does not roll it back', () => {
  const h = harness('raise'); touch(h, 'pointerdown', 1, 100); touch(h, 'pointermove', 1, 130); touch(h, 'pointerup', 1, 130);
  assert.equal(h.runtime.undo, 1); assert.equal(h.runtime.saves, 1); assert.equal(h.runtime.elevationOverrides.size, 2);
});
check('God target tap remains valid but pan/pinch cannot select a target', () => {
  const h = harness(null, { god: true }); touch(h, 'pointerdown', 1, 100); touch(h, 'pointerup', 1, 100);
  assert.equal(h.runtime.targets, 1);
  touch(h, 'pointerdown', 2, 100); touch(h, 'pointermove', 2, 150); touch(h, 'pointermove', 2, 100); touch(h, 'pointerup', 2, 100);
  touch(h, 'pointerdown', 3, 100); touch(h, 'pointerdown', 4, 200); touch(h, 'pointerup', 4, 200); touch(h, 'pointerup', 3, 100);
  assert.equal(h.runtime.targets, 1);
});
check('Battle is camera-only even with a construction tool selected', () => {
  const h = harness('wall1', { battle: true }); const before = h.camera.position.clone();
  touch(h, 'pointerdown', 1, 100); touch(h, 'pointermove', 1, 140); touch(h, 'pointerup', 1, 140);
  assert.ok(!h.camera.position.equals(before)); assert.equal(h.runtime.builds ?? 0, 0);
});
check('real camera pan/pinch remains bounded through extreme zoom and 2D pan', () => {
  const h = harness(); h.controls.enableRotate = false;
  const before = h.controls.target.clone();
  applyTouchCameraDelta(h.camera, h.controls, { fingers: 1, dx: 30, dy: 10, scale: 1 }, 400);
  assert.ok(!h.controls.target.equals(before));
  for (const scale of [10000, 0.00001, 10000]) {
    applyTouchCameraDelta(h.camera, h.controls, { fingers: 2, dx: 0, dy: 0, scale }, 400);
    const distance = h.camera.position.distanceTo(h.controls.target);
    assert.ok(distance >= 20 - 1e-6 && distance <= 200 + 1e-6);
    assert.ok(h.camera.position.toArray().every(Number.isFinite));
  }
});
check('desktop OrbitControls still receives mouse pan and wheel zoom', () => {
  const h = harness(); const before = h.camera.position.clone();
  h.canvas.fire('pointerdown', { ...point(1, 100), pointerType: 'mouse', button: 2 });
  h.canvas.fire('pointermove', { ...point(1, 140), pointerType: 'mouse', button: 2 });
  h.controls.update(); assert.ok(!h.camera.position.equals(before));
  h.canvas.fire('pointerup', { ...point(1, 140), pointerType: 'mouse', button: 2 });
  const distance = h.controls.getDistance();
  h.canvas.fire('wheel', { pointerType: 'mouse', deltaY: -100, deltaMode: 0 });
  assert.ok(h.controls.getDistance() < distance);
});
console.log(`${passed} executable touch gesture checks passed.`);
