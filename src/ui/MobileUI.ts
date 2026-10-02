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
        <div class="mobile-header-actions" role="toolbar" aria-label="Game actions">
          <button type="button" data-mobile-proxy="toolbar-open" class="mobile-action mobile-build-action" aria-label="Build tools" aria-controls="toolbar" aria-expanded="false"><span aria-hidden="true">🧱</span></button>
          <button type="button" data-mobile-proxy="header-undo-button" class="mobile-action" aria-label="Undo" title="Undo" disabled><span aria-hidden="true">↶</span></button>
          <button type="button" data-mobile-proxy="screenshot-button" class="mobile-action" aria-label="Take screenshot" title="Take screenshot"><span aria-hidden="true">📷</span></button>
          <button type="button" data-mobile-proxy="battle-button" class="mobile-action" aria-label="Battle and military">⚔️</button>
          <button type="button" data-mobile-proxy="god-mode-button" class="mobile-action" aria-label="God Mode">⚡</button>
          <button type="button" data-mobile-action="templates" class="mobile-action" aria-label="Templates">▧</button>
          <button type="button" data-mobile-proxy="missions-button" class="mobile-action" aria-label="Mission Journal" aria-controls="mission-journal" aria-expanded="false"><span aria-hidden="true">📜</span></button>
          <button type="button" data-mobile-proxy="settings-button" class="mobile-action" aria-label="Settings">⚙</button>
        </div>
      </header>
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
        if (target instanceof HTMLButtonElement) {
          target.click();
          this.syncProxyVisibility();
        }
      });
    });

    layer.querySelectorAll<HTMLButtonElement>('[data-mobile-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.mobileAction as SystemAction | undefined;
        if (action) requestSystemAction(action);
      });
    });

    const proxyTargetIds = new Set(
      Array.from(layer.querySelectorAll<HTMLButtonElement>('[data-mobile-proxy]'))
        .map((button) => button.dataset.mobileProxy)
        .filter((id): id is string => Boolean(id)),
    );
    for (const targetId of proxyTargetIds) {
      const target = document.getElementById(targetId);
      if (!(target instanceof HTMLButtonElement)) continue;
      const observer = new MutationObserver(() => this.syncProxyVisibility());
      observer.observe(target, {
        attributes: true,
        attributeFilter: ['hidden', 'disabled', 'aria-expanded'],
      });
      this.observers.push(observer);
    }
    this.syncProxyVisibility();
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

  private syncProxyVisibility(): void {
    document.querySelectorAll<HTMLButtonElement>('[data-mobile-proxy]').forEach((proxy) => {
      const targetId = proxy.dataset.mobileProxy;
      if (!targetId) return;
      const target = document.getElementById(targetId);
      const isButton = target instanceof HTMLButtonElement;
      proxy.hidden = !isButton || target.hidden;
      proxy.disabled = !isButton || target.disabled;
      if (isButton) {
        const expanded = target.getAttribute('aria-expanded');
        if (expanded !== null) proxy.setAttribute('aria-expanded', expanded);
        else proxy.removeAttribute('aria-expanded');
      }
    });
  }
}
