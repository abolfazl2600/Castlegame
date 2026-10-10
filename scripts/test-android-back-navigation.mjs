import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { handleAndroidBackAction } from '../src/android/androidBackAction.ts';

const keyEvents = [];
globalThis.window = { dispatchEvent: (event) => { keyEvents.push(event.key); return true; } };
globalThis.KeyboardEvent = class {
  constructor(type, options) { this.type = type; this.key = options.key; }
};
globalThis.getComputedStyle = (element) => ({ display: element.display ?? 'block' });

function element(visible = false, onClick = () => {}) {
  return {
    hidden: !visible,
    display: 'block',
    clicks: 0,
    click() { this.clicks += 1; onClick(); },
    classList: { contains: () => false },
    getClientRects() { return this.hidden ? [] : [{}]; },
  };
}

function setup() {
  let minimizes = 0;
  const mission = element();
  const missionButton = element(true, () => { mission.hidden = true; });
  const settings = element();
  const settingsClose = element(true, () => { settings.hidden = true; });
  const map = element();
  const help = element();
  const helpClose = element(true, () => { help.hidden = true; });
  const toolbar = element();
  toolbar.classList.contains = (className) => className === 'is-collapsed' ? toolbar.hidden : false;
  const toolbarClose = element(true, () => { toolbar.hidden = true; });
  const ids = new Map([
    ['mission-journal', mission],
    ['settings-modal', settings], ['settings-close', settingsClose],
    ['map-layout-modal', map], ['help-modal', help], ['help-close-button', helpClose],
    ['toolbar', toolbar], ['toolbar-close', toolbarClose],
  ]);
  const unknown = [];
  let selectedTool = false;
  const doc = {
    getElementById: (id) => ids.get(id) ?? null,
    querySelector: (selector) => {
      if (selector === '#mission-journal [data-mission-action="close"]') return missionButton;
      if (selector === '[data-tool].is-selected') return selectedTool ? {} : null;
      return null;
    },
    querySelectorAll: (selector) =>
      selector === 'dialog[open], [role="dialog"]'
        ? [...(mission.hidden ? [] : [mission]), ...unknown]
        : [],
  };
  const back = () => handleAndroidBackAction(doc, () => { minimizes += 1; });
  return {
    mission, missionButton, settings, settingsClose, map, help, helpClose,
    toolbar, toolbarClose, unknown, back,
    selectTool: () => { selectedTool = true; },
    get minimizes() { return minimizes; },
  };
}

{
  const s = setup();
  s.mission.hidden = false;
  s.back();
  assert.equal(s.mission.hidden, true, 'Android Back must use the journal close action');
  assert.equal(s.missionButton.clicks, 1, 'delegated close must be activated exactly once');
  assert.equal(s.minimizes, 0, 'closing a mission journal must not minimize Android');
  s.back();
  assert.equal(s.missionButton.clicks, 1, 'repeated Back must not re-close a hidden mission journal');
  assert.equal(s.minimizes, 1, 'with no active interface Back should minimize as before');
}
{
  const s = setup();
  s.mission.hidden = false;
  s.settings.hidden = false;
  s.back();
  assert.equal(s.settingsClose.clicks, 1, 'Settings must retain its existing higher priority');
  assert.equal(s.mission.hidden, false, 'mission journal stays open if Settings took Back');
  s.back();
  assert.equal(s.mission.hidden, true, 'the next Back should close the mission journal');
  assert.equal(s.minimizes, 0);
}
{
  const s = setup();
  s.map.hidden = false;
  s.mission.hidden = false;
  s.back();
  assert.equal(s.mission.hidden, false, 'mandatory map choice must not be bypassed');
  assert.equal(s.minimizes, 0);
}
{
  const s = setup();
  s.help.hidden = false;
  s.mission.hidden = false;
  s.back();
  assert.equal(s.helpClose.clicks, 1, 'existing Help modal priority must remain intact');
  assert.equal(s.mission.hidden, false);
}
{
  const s = setup();
  s.unknown.push(element(true));
  s.back();
  assert.equal(s.minimizes, 0, 'unhandled visible dialogs must prevent minimizing');
}
{
  const s = setup();
  s.toolbar.hidden = false;
  s.back();
  assert.equal(s.toolbarClose.clicks, 1, 'Back closes the Build toolbar when no dialog is open');
  assert.equal(s.minimizes, 0);
}
{
  const s = setup();
  s.selectTool();
  s.back();
  assert.equal(keyEvents.at(-1), 'Escape', 'Back cancels active world tools');
  assert.equal(s.minimizes, 0);
}

const [nativeSource, missionSource] = await Promise.all([
  readFile(new URL('../src/android/androidBackNavigation.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/missions/MissionUI.ts', import.meta.url), 'utf8'),
]);
assert.match(nativeSource, /Capacitor\.isNativePlatform\(\)/, 'native-only listener must remain guarded');
assert.match(nativeSource, /handleAndroidBackAction\(document,/);
assert.match(missionSource, /data-mission-action="close"/);
assert.match(missionSource, /if \(action === 'close'\) setOpen\(false\)/);

console.log('Android Back mission-journal dismissal and modal priority regression: ok');
