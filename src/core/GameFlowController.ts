import type { BattleStatus } from './battle/types';
import { SaveSystem } from './core/SaveSystem';
import { SAVE_KEY } from './core/constants';
import type { ThreeGame } from './ThreeGame';

type CoreState = 'MAIN_MENU' | 'BATTLE' | 'PAUSED' | 'VICTORY' | 'DEFEAT' | 'SETTINGS';

const PROGRESS_KEY = 'castle-role.core-progress.v1';

export class GameFlowController {
  private state: CoreState = 'MAIN_MENU';
  private overlay: HTMLElement;
  private settingsReturnState: CoreState = 'MAIN_MENU';
  private transitionLocked = false;
  private lifecyclePaused = false;

  constructor(private readonly game: ThreeGame) {
    this.overlay = this.createOverlay();
    document.body.appendChild(this.overlay);
    this.bind();
    this.syncContinue();
    this.showMainMenu();

    window.addEventListener('castlegame:battle-state', (event) => {
      const status = (event as CustomEvent<BattleStatus>).detail;
      this.handleBattleStatus(status);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (this.state === 'BATTLE') {
        event.preventDefault();
        this.pauseBattle();
      } else if (this.state === 'PAUSED') {
        event.preventDefault();
        this.resumeBattle();
      } else if (this.state === 'SETTINGS') {
        event.preventDefault();
        this.returnFromSettings();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.state === 'BATTLE' && this.game.getBattleStatus().mode === 'running') {
          this.game.pauseCoreBattle();
          this.lifecyclePaused = true;
        }
        return;
      }

      if (this.lifecyclePaused) {
        this.lifecyclePaused = false;
        this.state = 'PAUSED';
        this.render();
      }
    });
  }

  private createOverlay(): HTMLElement {
    const root = document.createElement('div');
    root.id = 'core-game-flow';
    root.innerHTML = `
      <div class="core-flow-backdrop"></div><button class="core-flow-pause-button" data-flow-action="pause" type="button" aria-label="Pause battle">Ⅱ</button>
      <main class="core-flow-card" role="dialog" aria-modal="true" aria-labelledby="core-flow-title">
        <div class="core-flow-eyebrow">CASTLEGAME</div>
        <h1 id="core-flow-title">Castle Command</h1>
        <p class="core-flow-subtitle" data-flow-subtitle>Defend the castle. Complete the objective.</p>
        <section class="core-flow-screen" data-flow-screen="menu">
          <button class="core-flow-primary" data-flow-action="new">NEW GAME</button>
          <button class="core-flow-secondary" data-flow-action="continue">CONTINUE</button>
          <button class="core-flow-secondary" data-flow-action="settings">SETTINGS</button>
        </section>
        <section class="core-flow-screen" data-flow-screen="pause" hidden>
          <button class="core-flow-primary" data-flow-action="resume">RESUME</button>
          <button class="core-flow-secondary" data-flow-action="restart">RESTART BATTLE</button>
          <button class="core-flow-secondary" data-flow-action="settings">SETTINGS</button>
          <button class="core-flow-secondary" data-flow-action="menu">MAIN MENU</button>
        </section>
        <section class="core-flow-screen" data-flow-screen="result" hidden>
          <div class="core-flow-result" data-flow-result></div>
          <div class="core-flow-result-stats" data-flow-stats></div>
          <button class="core-flow-primary" data-flow-action="retry">RETRY</button>
          <button class="core-flow-secondary" data-flow-action="menu">MAIN MENU</button>
        </section>
        <section class="core-flow-screen" data-flow-screen="settings" hidden>
          <button class="core-flow-secondary" data-flow-action="settings-open">OPEN SETTINGS</button>
          <button class="core-flow-secondary" data-flow-action="settings-back">BACK</button>
        </section>
      </main>
    `;
    return root;
  }

  private bind(): void {
    this.overlay.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-flow-action]');
      if (!button || button.disabled || this.transitionLocked) return;

      const action = button.dataset.flowAction;
      if (!action) return;

      switch (action) {
        case 'new': this.startNewGame(); break;
        case 'continue': this.continueGame(); break;
        case 'settings': this.openSettings(this.state); break;
        case 'pause': this.pauseBattle(); break;
        case 'settings-open': this.openSettings(this.settingsReturnState); break;
        case 'settings-back': this.returnFromSettings(); break;
        case 'resume': this.resumeBattle(); break;
        case 'restart': this.restartBattle(); break;
        case 'retry': this.retryBattle(); break;
        case 'menu': this.returnToMainMenu(); break;
      }
    });

    document.getElementById('settings-close')?.addEventListener('click', () => {
      if (this.state === 'SETTINGS') this.returnFromSettings();
    });
  }

  private async runTransition(action: () => void): Promise<void> {
    if (this.transitionLocked) return;
    this.transitionLocked = true;
    try {
      action();
    } finally {
      window.setTimeout(() => { this.transitionLocked = false; }, 250);
    }
  }

  private startNewGame(): void {
    void this.runTransition(() => {
      this.game.startCoreNewGame();
      localStorage.setItem(PROGRESS_KEY, '1');
      this.state = 'BATTLE';
      this.hideOverlay();
      this.render();
    });
  }

  private continueGame(): void {
    void this.runTransition(() => {
      if (!this.hasContinue()) {
        this.syncContinue();
        return;
      }
      if (!this.game.continueCoreGame()) return;
      localStorage.setItem(PROGRESS_KEY, '1');
      this.state = 'BATTLE';
      this.hideOverlay();
      this.render();
    });
  }

  private pauseBattle(): void {
    this.game.pauseCoreBattle();
    this.state = 'PAUSED';
    this.showOverlay();
    this.render();
  }

  private resumeBattle(): void {
    void this.runTransition(() => {
      this.game.resumeCoreBattle();
      this.state = 'BATTLE';
      this.hideOverlay();
      this.render();
    });
  }

  private restartBattle(): void {
    void this.runTransition(() => {
      const confirmed = this.game.getSettings().interface.confirmDestructiveActions
        ? window.confirm('Restart this battle? Current battle progress will be lost.')
        : true;
      if (!confirmed) return;
      this.game.restartCoreBattle();
      this.state = 'BATTLE';
      this.hideOverlay();
      this.render();
    });
  }

  private retryBattle(): void {
    this.restartBattle();
  }

  private returnToMainMenu(): void {
    void this.runTransition(() => {
      this.game.returnToCoreMainMenu();
      this.state = 'MAIN_MENU';
      this.showMainMenu();
      this.syncContinue();
    });
  }

  private openSettings(returnState: CoreState): void {
    this.settingsReturnState = returnState;
    this.state = 'SETTINGS';
    this.hideOverlay();
    document.getElementById('settings-button')?.click();
  }

  private returnFromSettings(): void {
    document.getElementById('settings-modal')?.setAttribute('hidden', '');
    this.state = this.settingsReturnState;
    if (this.state === 'MAIN_MENU' || this.state === 'PAUSED') {
      this.showOverlay();
      this.render();
    }
  }

  private handleBattleStatus(status: BattleStatus): void {
    if (status.mode === 'finished' && status.result) {
      localStorage.setItem(PROGRESS_KEY, '1');
      this.state = status.result.winner === 'attacker' ? 'VICTORY' : 'DEFEAT';
      this.showOverlay();
      this.render(status);
      return;
    }

    if (status.mode === 'paused' && this.state === 'BATTLE') {
      this.state = 'PAUSED';
      this.showOverlay();
      this.render(status);
      return;
    }

    if (status.mode === 'running' && this.state === 'PAUSED') {
      this.state = 'BATTLE';
      this.hideOverlay();
    }
  }

  private showMainMenu(): void {
    this.showOverlay();
    this.render();
    document.getElementById('game-mode-modal')?.setAttribute('hidden', '');
    document.getElementById('templates-modal')?.setAttribute('hidden', '');
    document.getElementById('battle-panel')?.setAttribute('hidden', '');
  }

  private showOverlay(): void {
    this.overlay.hidden = false;
  }

  private hideOverlay(): void {
    this.overlay.hidden = true;
    document.getElementById('game-mode-modal')?.setAttribute('hidden', '');
    document.getElementById('templates-modal')?.setAttribute('hidden', '');
  }

  private render(status = this.game.getBattleStatus()): void {
    this.overlay.dataset.flowState = this.state;
    this.overlay.querySelectorAll<HTMLElement>('[data-flow-screen]').forEach((screen) => {
      screen.hidden = true;
    });

    const subtitle = this.overlay.querySelector<HTMLElement>('[data-flow-subtitle]');
    const result = this.overlay.querySelector<HTMLElement>('[data-flow-result]');
    const stats = this.overlay.querySelector<HTMLElement>('[data-flow-stats]');
    const continueButton = this.overlay.querySelector<HTMLButtonElement>('[data-flow-action="continue"]');
    const pauseButton = this.overlay.querySelector<HTMLButtonElement>('[data-flow-action="pause"]');
    if (pauseButton) pauseButton.hidden = this.state !== 'BATTLE';

    if (this.state === 'MAIN_MENU') {
      this.overlay.querySelector<HTMLElement>('[data-flow-screen="menu"]')!.hidden = false;
      if (subtitle) subtitle.textContent = 'Defend the castle. Complete the objective.';
      this.syncContinue();
      return;
    }

    if (this.state === 'PAUSED') {
      this.overlay.querySelector<HTMLElement>('[data-flow-screen="pause"]')!.hidden = false;
      if (subtitle) subtitle.textContent = 'Battle paused. Simulation is stopped.';
      return;
    }

    if (this.state === 'VICTORY' || this.state === 'DEFEAT') {
      this.overlay.querySelector<HTMLElement>('[data-flow-screen="result"]')!.hidden = false;
      const victory = this.state === 'VICTORY';
      if (result) result.textContent = victory ? 'VICTORY' : 'DEFEAT';
      if (subtitle) subtitle.textContent = victory
        ? 'The battle objective was completed.'
        : 'The battle ended without completing the objective.';
      if (stats && status.result) {
        const completed = status.result.completedObjectives?.length ?? 0;
        const failed = status.result.failedObjectives?.length ?? 0;
        stats.textContent = `Objective results: ${completed} completed · ${failed} failed · Duration ${status.result.durationSeconds.toFixed(1)}s`;
      }
      return;
    }

    if (this.state === 'SETTINGS') {
      this.overlay.querySelector<HTMLElement>('[data-flow-screen="settings"]')!.hidden = false;
      return;
    }

    if (continueButton) continueButton.disabled = !this.hasContinue();
  }

  private syncContinue(): void {
    const button = this.overlay.querySelector<HTMLButtonElement>('[data-flow-action="continue"]');
    if (button) button.disabled = !this.hasContinue();
  }

  private hasContinue(): boolean {
    return localStorage.getItem(PROGRESS_KEY) === '1' || localStorage.getItem(SAVE_KEY) !== null;
  }
}
