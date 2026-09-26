import { ThreeGame } from './ThreeGame';
import { PrivacyLegalUI } from './core/PrivacyLegalUI';
import { MobileUI } from './ui/MobileUI';
import './style.css';

const gameRoot = document.getElementById('game');
if (!gameRoot) throw new Error('Game root was not found');

new ThreeGame(gameRoot);
new MobileUI();
new PrivacyLegalUI();
