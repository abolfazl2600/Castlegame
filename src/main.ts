import { ThreeGame } from './ThreeGame';
import { MobileUI } from './ui/MobileUI';
import { SettingsStore } from './settings/SettingsStore';
import { SettingsUI } from './settings/SettingsUI';
import { GameFlowController } from './core/GameFlowController';
import './core/GameFlowController.css';
import './style.css';

const gameRoot = document.getElementById('game');
if (!gameRoot) throw new Error('Game root was not found');

const settingsStore = new SettingsStore(localStorage);

new ThreeGame(gameRoot, settingsStore);
new MobileUI();

new SettingsUI(settingsStore, () => {
  settingsStore.resetLocalSave();
  window.location.reload();
});

new GameFlowController(game);
