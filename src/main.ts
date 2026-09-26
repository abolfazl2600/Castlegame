import { ThreeGame } from './ThreeGame';
import { MobileUI } from './ui/MobileUI';
import { SettingsStore } from './settings/SettingsStore';
import { SettingsUI } from './settings/SettingsUI';
import { FarmLifeSystem } from './systems/FarmLifeSystem';
import './style.css';

const gameRoot = document.getElementById('game');
if (!gameRoot) throw new Error('Game root was not found');

const settingsStore = new SettingsStore(localStorage);

const game = new ThreeGame(gameRoot, settingsStore);
new FarmLifeSystem(game);
new MobileUI();

new SettingsUI(settingsStore, () => {
  settingsStore.resetLocalSave();
  window.location.reload();
});
