/**
 * Mobile presentation layer for Castle Role.
 *
 * This module owns only mobile layout and input affordances. All actions proxy
 * to the existing DOM controls so gameplay/application logic stays unchanged.
 */
export class MobileUI {
  private readonly shell: HTMLElement;
  private readonly root: HTMLElement;
  private readonly mediaQuery = window.matchMedia('(max-width: 760px)');
  private readonly observers: MutationObserver[] = [];

  constructor() {
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
          <button type="button" data-mobile-proxy="battle-button" class="mobile-action" aria-label="Battle">⚔️</button>
          <button type="button" data-mobile-proxy="settings-button" class="mobile-action" aria-label="Settings">⚙</button>
          <button type="button" data-mobile-proxy="fullscreen-button" class="mobile-action" aria-label="Fullscreen">⛶</button>
          <button type="button" data-mobile-proxy="reset-button" class="mobile-action mobile-danger" aria-label="Reset">↻</button>
        </div>
      </header>

      <nav class="mobile-bottom-dock" aria-label="Mobile game controls">
        <button type="button" data-mobile-proxy="toolbar-open" class="mobile-dock-button"><span aria-hidden="true">🧱</span><small>Build</small></button>
        <button type="button" data-mobile-proxy="view-3d-button" class="mobile-dock-button"><span aria-hidden="true">◇</span><small>3D</small></button>
        <button type="button" data-mobile-proxy="view-2d-button" class="mobile-dock-button"><span aria-hidden="true">▦</span><small>Plan</small></button>
        <button type="button" data-mobile-proxy="camera-45-button" class="mobile-dock-button"><span aria-hidden="true">◒</span><small>45°</small></button>
        <button type="button" data-mobile-proxy="camera-top-button" class="mobile-dock-button"><span aria-hidden="true">⊙</span><small>Top</small></button>
        <button type="button" data-mobile-proxy="settings-button" class="mobile-dock-button"><span aria-hidden="true">⚙</span><small>Settings</small></button>
      </nav>

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
        const target = document.getElementById(targetId);
        if (target instanceof HTMLButtonElement) target.click();
      });
    });

    this.syncModeLabel();
    this.observeText('game-mode-label', () => this.syncModeLabel());
    this.observeText('save-status', () => this.syncStatus());
    this.syncStatus();
  }

  private bindResponsiveState(): void {
    const apply = (): void => {
      this.root.classList.toggle('mobile-ui-active', this.mediaQuery.matches);
    };
    apply();
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
      proxy.hidden = target instanceof HTMLButtonElement && target.hidden;
    });
  }

  private syncStatus(): void {
    const source = document.getElementById('save-status');
    const target = document.querySelector<HTMLElement>('[data-mobile-status]');
    if (!source || !target) return;
    target.textContent = source.textContent?.trim() || 'Ready';
  }
}
