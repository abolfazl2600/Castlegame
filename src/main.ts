import { ThreeGame } from './ThreeGame';
import { MobileUI } from './ui/MobileUI';
import { AudioManager } from './audio/AudioManager';
import { bindAudioSettingsUI } from './audio/AudioSettingsUI';
import './style.css';

const gameRoot = document.getElementById('game');
if (!gameRoot) throw new Error('Game root was not found');

const audioManager = new AudioManager();
bindAudioSettingsUI(audioManager);

new ThreeGame(gameRoot);
new MobileUI();
