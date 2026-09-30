import { MobileUI } from './ui/MobileUI';
import { installLocalization } from './i18n/localization';
import { SettingsStore } from './settings/SettingsStore';
import { SettingsUI } from './settings/SettingsUI';
import { AndroidUpdateUI } from './settings/AndroidUpdateUI';
import { installAndroidBackNavigation } from './android/androidBackNavigation';
import './style.css';

const settingsStore = new SettingsStore(localStorage);
installLocalization(settingsStore);

new SettingsUI(settingsStore, () => {
  settingsStore.resetLocalSave();
  window.location.reload();
});

new AndroidUpdateUI();

try {
  new MobileUI(settingsStore);
} catch (error) {
  console.error('Mobile UI initialization failed', error);
}

installAndroidBackNavigation();
void startGameRuntime();

async function startGameRuntime(): Promise<void> {
  try {
    const gameRoot = document.getElementById('game');
    if (!gameRoot) throw new Error('Game root was not found');

    const [{ ThreeGame }, { FarmLifeSystem }] = await Promise.all([
      import('./ThreeGame'),
      import('./systems/FarmLifeSystem'),
    ]);

    const game = new ThreeGame(gameRoot, settingsStore);
    new FarmLifeSystem(game);
  } catch (error) {
    console.error('Game initialization failed', error);
    const status = document.getElementById('save-status');
    if (status) status.textContent = 'Game initialization failed · Settings available';
  }
}
