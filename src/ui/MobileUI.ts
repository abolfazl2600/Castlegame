import { requestOpenSettings, requestSystemAction, type SystemAction } from '../app/applicationActions';
import type { SettingsStore } from '../settings/SettingsStore';

/**
 * Mobile presentation layer for Castle Role.
 *
 * This module owns only mobile layout and input affordances. Gameplay actions proxy
 * to existing DOM controls; application-level actions use their canonical commands.
 */
export class MobileUI {
  private readonly shell: HTMLElement;
  private readonly root: HTMLElement;
  private readonly mediaQuery = window.matchMedia('(max-width: 760px), (pointer: coarse) and (max-height: 700px)');
  private readonly observers: MutationObserver[] = [];
  private touchPreference = false;

  constructor(private readonly settingsStore: SettingsStore) {
    const shell = document.getElementById('game-shell');
    const root = document.documentElement;
    if (!shell) throw new Error('Game shell was not found');

    this.shell = shell;
    this.root = root;
    this.render();
    this.bindResponsiveState();
  }

  private render(): void {
    if (document.getElementById('mobile-ui')) return;

    const layer = document.createElement('div');
    layer.id = 'mobile-ui';
    layer.className = 'mobile-ui';
    layer.innerHTML = `
      <header class="mobile-header" aria-label="Mobile game actions">
        <div class="mobile-brand">
          <span class="mobile-eyebrow">CASTLE ROLE</span>
          <strong>Stronghold</strong>
        </div>
        <div class="mobile-header-actions" role="toolbar" aria-label="Game actions">
          <button type="button" data-mobile-proxy="game-mode-button" class="mobile-action mobile-mode-action"></button>
          <button type="button" data-mobile-proxy="toolbar-open" class="mobile-action mobile-build-action" aria-label="Build tools" aria-controls="toolbar" aria-expanded="false"><span aria-hidden="true">🧱</span><span>Build</span></button>
          <button type="button" data-mobile-proxy="battle-button" class="mobile-action" aria-label="Battle and military">⚔️</button>
          <button type="button" data-mobile-proxy="god-mode-button" class="mobile-action" aria-label="God Mode">⚡</button>
          <button type="button" data-mobile-action="templates" class="mobile-action" aria-label="Templates">▧</button>
          <button type="button" data-mobile-action="save" class="mobile-action" aria-label="Save game">↓</button>
          <button type="button" data-mobile-action="load" class="mobile-action" aria-label="Load game">↑</button>
          <button type="button" data-mobile-proxy="settings-button" class="mobile-action" aria-label="Settings">⚙</button>
          <button type="button" data-mobile-proxy="reset-button" class="mobile-action mobile-danger" aria-label="Reset">↻</button>
        </div>
      </header>

      <div class="mobile-status" aria-live="polite">
        <span class="mobile-status-dot" aria-hidden="true"></span>
        <span data-mobile-status>Ready</span>
      </div>
    `;

    this.shell.appendChild(layer);

    layer.querySelectorAll<HTMLButtonElement>('[data-mobile-proxy]').forEach((button) => {
      button.addEventListener('click', () => {
        const targetId = button.dataset.mobileProxy;
        if (!targetId) return;

        if (targetId === 'settings-button') {
          requestOpenSettings();
          return;
        }

        const target = document.getElementById(targetId);
        if (target instanceof HTMLButtonElement) target.click();
      });
    });

    layer.querySelectorAll<HTMLButtonElement>('[data-mobile-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.mobileAction as SystemAction | undefined;
        if (action) requestSystemAction(action);
      });
    });

    this.syncModeLabel();
    this.observeText('game-mode-label', () => this.syncModeLabel());
    this.observeText('save-status', () => this.syncStatus());
    const godModeButton = document.getElementById('god-mode-button');
    if (godModeButton) {
      const observer = new MutationObserver(() => this.syncProxyVisibility());
      observer.observe(godModeButton, { attributes: true, attributeFilter: ['hidden'] });
      this.observers.push(observer);
    }
    this.syncProxyVisibility();
    this.syncStatus();
  }

  private bindResponsiveState(): void {
    const apply = (): void => {
      const active = this.mediaQuery.matches || this.touchPreference;
      // Keep the full military information visible on desktop; start mobile in compact mode.
      if (active !== this.root.classList.contains('mobile-ui-active')) {
        const advanced = document.querySelector<HTMLDetailsElement>('.battle-advanced');
        if (advanced) advanced.open = !active;
      }
      this.root.classList.toggle('mobile-ui-active', active);
      this.root.classList.toggle('touch-ui-forced', this.touchPreference);
      this.root.dataset.inputMode = this.touchPreference ? 'touch' : 'standard';
    };

    this.settingsStore.subscribe((settings) => {
      this.touchPreference = settings.gameplay.controlScheme === 'touch';
      apply();
    });
    this.mediaQuery.addEventListener('change', apply);
  }

  private observeText(id: string, callback: () => void): void {
    const target = document.getElementById(id);
    if (!target) return;
    const observer = new MutationObserver(callback);
    observer.observe(target, { childList: true, characterData: true, subtree: true });
    this.observers.push(observer);
  }

  private syncModeLabel(): void {
    const target = document.getElementById('game-mode-label');
    const button = document.querySelector<HTMLButtonElement>('[data-mobile-proxy="game-mode-button"]');
    if (target && button) {
      button.textContent = target.textContent?.trim() || 'Mode';
    }

    this.syncProxyVisibility();
  }

  private syncProxyVisibility(): void {
    document.querySelectorAll<HTMLButtonElement>('[data-mobile-proxy]').forEach((proxy) => {
      const targetId = proxy.dataset.mobileProxy;
      if (!targetId || targetId === 'game-mode-button') return;
      const target = document.getElementById(targetId);
      proxy.hidden = !(target instanceof HTMLButtonElement) || target.hidden;
    });
  }

  private syncStatus(): void {
    const source = document.getElementById('save-status');
    const target = document.querySelector<HTMLElement>('[data-mobile-status]');
    if (!source || !target) return;
    target.textContent = source.textContent?.trim() || 'Ready';
  }
}
