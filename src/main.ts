import { ThreeGame } from './ThreeGame';
import './style.css';

const gameRoot = document.getElementById('game');
if (!gameRoot) throw new Error('Game root was not found');

new ThreeGame(gameRoot);
