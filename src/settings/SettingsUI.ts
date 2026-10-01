import {
  registerOpenSettings,
  requestOpenSettings,
  requestSystemAction,
  type SystemAction,
} from '../app/applicationActions';
import type { SettingsStore } from './SettingsStore';
import type { SettingsData } from './SettingsModel';
import { resolveLocale, translate } from '../i18n/localization';

type SettingsPane = 'overview' | 'general' | 'graphics' | 'audio' | 'gameplay' | 'accessibility' | 'controls' | 'data';

export class SettingsUI {
  private readonly panel: HTMLElement;
  private readonly backdrop: HTMLElement;
  private activePane: SettingsPane = 'overview';

  constructor(
    private readonly store: SettingsStore,
    private readonly onResetSave: () => void,
  ) {
    const settingsButton = document.getElementById('settings-button');
    if (!(settingsButton instanceof HTMLButtonElement)) {
      throw new Error('Settings button was not found');
    }

    if (document.getElementById('settings-modal') || document.getElementById('settings-backdrop')) {
      throw new Error('SettingsUI has already been initialized');
    }

    this.backdrop = this.createBackdrop();
    this.panel = this.createBasePanel();
    document.body.appendChild(this.backdrop);
    document.body.appendChild(this.panel);

    this.bindOpenCloseActions(settingsButton);
    this.bindNavigation();
    this.bindCoreControls();
    this.store.subscribe((settings) => this.render(settings));
    void this.installOptionalSections();
  }

  open(): void {
    this.backdrop.hidden = false;
    this.backdrop.setAttribute('aria-hidden', 'false');
    this.panel.hidden = false;
    this.panel.setAttribute('aria-hidden', 'false');
    this.activatePane(this.activePane);
    this.panel.querySelector<HTMLElement>('[data-settings-autofocus]')?.focus();
  }

  close(): void {
    this.panel.hidden = true;
    this.panel.setAttribute('aria-hidden', 'true');
    this.backdrop.hidden = true;
    this.backdrop.setAttribute('aria-hidden', 'true');
  }

  appendSection(section: HTMLElement): void {
    const dataPane = this.panel.querySelector<HTMLElement>('[data-settings-pane="data"]');
    dataPane?.appendChild(section);
  }

  scrollToSection(id: string): void {
    const target = this.panel.querySelector<HTMLElement>(`#${id}`);
    if (!target) return;
    const pane = target.closest<HTMLElement>('[data-settings-pane]');
    const paneName = pane?.dataset.settingsPane as SettingsPane | undefined;
    if (paneName) this.activatePane(paneName);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private createBackdrop(): HTMLElement {
    const backdrop = document.createElement('div');
    backdrop.id = 'settings-backdrop';
    backdrop.className = 'settings-backdrop';
    backdrop.hidden = true;
    backdrop.setAttribute('aria-hidden', 'true');
    return backdrop;
  }

  private createBasePanel(): HTMLElement {
    const panel = document.createElement('section');
    panel.id = 'settings-modal';
    panel.className = 'settings-modal';
    panel.hidden = true;
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = `
      <div class="settings-card" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header class="settings-header">
          <div class="settings-header-copy">
            <span class="settings-eyebrow">CASTLE CONTROL CENTER</span>
            <h2 id="settings-title">Settings</h2>
            <p>Game actions, visuals, sound and accessibility in one place.</p>
          </div>
          <button id="settings-close" type="button" aria-label="Close settings">×</button>
        </header>

        <div class="settings-layout">
          <nav class="settings-nav" aria-label="Settings sections">
            ${this.navButton('overview', '⌂', 'Overview', true)}
            ${this.navButton('general', '⚙', 'General')}
            ${this.navButton('graphics', '◈', 'Graphics')}
            ${this.navButton('audio', '♫', 'Audio')}
            ${this.navButton('gameplay', '♟', 'Gameplay')}
            ${this.navButton('accessibility', '◎', 'Accessibility')}
            ${this.navButton('controls', '⌨', 'Controls')}
            ${this.navButton('data', '▣', 'Data')}
          </nav>

          <div class="settings-scroll">
            <section class="settings-pane is-active" data-settings-pane="overview">
              <div class="settings-pane-heading">
                <div><span class="settings-section-eyebrow">QUICK ACCESS</span><h3>Game Actions</h3></div>
                <span class="settings-section-badge">LIVE</span>
              </div>
              <p class="settings-section-note">Open game dialogs directly. Settings closes first so no dialog can appear underneath it.</p>
              <div class="settings-system-actions">
                ${this.actionButton('help', '?', 'Help', 'Game guide and controls')}
                ${this.actionButton('load', '↓', 'Load Game', 'Choose autosave, quick save or a slot')}
                ${this.actionButton('save', '↑', 'Save Game', 'Quick save or choose a manual slot')}
                ${this.actionButton('templates', '▦', 'Templates', 'Choose a starting world')}
                <button type="button" data-action="reset-world"><span class="settings-action-icon" aria-hidden="true">↻</span><span class="settings-action-copy"><strong>Reset World</strong><small>Start a new world and choose a game mode</small></span><span aria-hidden="true">›</span></button>
              </div>
              <div class="settings-info-strip" data-settings-action-status>
                <span class="settings-info-dot"></span>
                <span>Runtime actions are ready when the game canvas has loaded.</span>
              </div>
            </section>

            <section class="settings-pane" data-settings-pane="general">
              ${this.paneHeading('GENERAL', 'Interface & Preferences', 'Tune the interface without changing your world.')}
              <div class="settings-control-card">
                ${this.rangeRow('UI scale', 'Scale menus and HUD elements.', 'uiScale', 0.75, 1.5, 0.05)}
                ${this.selectRow('Language', 'Choose the interface language source.', 'language', '<option value="system">System language</option><option value="en">English</option><option value="fa">فارسی</option>')}
                ${this.toggleRow('Confirm destructive actions', 'Ask before reset and other destructive actions.', 'confirmDestructiveActions')}
                ${this.toggleRow('Show help', 'Allow the in-game help dialog to open.', 'showHelp')}
              </div>
            </section>

            <section class="settings-pane" data-settings-pane="graphics">
              ${this.paneHeading('VISUALS', 'Graphics', 'Balance scene detail and performance.')}
              <div class="settings-control-card">
                ${this.selectRow('Graphics quality', 'Overall rendering quality preset.', 'quality', '<option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>')}
                ${this.selectRow('Render profile', 'Auto adapts to sustained frame rate; manual presets never depend on touch controls.', 'performanceMode', '<option value="auto">Auto (adaptive)</option><option value="performance">Performance</option><option value="balanced">Balanced</option><option value="quality">Quality</option>')}
                ${this.selectRow('Environment detail', 'Controls decorative world detail.', 'environmentDetail', '<option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>')}
                ${this.toggleRow('Shadows', 'Render dynamic scene shadows.', 'shadowsEnabled')}
                ${this.toggleRow('Visual effects', 'Enable enhanced lighting and effects.', 'effectsEnabled')}
                ${this.toggleRow('Debug mode', 'Show live FPS, memory, renderer and LOD diagnostics over the game.', 'debugMode')}
              </div>
            </section>

            <section class="settings-pane" data-settings-pane="audio">
              ${this.paneHeading('SOUND', 'Audio', 'Procedural ambience and game feedback. Audio unlocks after your first interaction.')}
              <div class="settings-audio-status"><span>♪</span><div><strong>Procedural sound engine</strong><small>No external audio download is required.</small></div></div>
              <div class="settings-control-card">
                ${this.rangeRow('Master volume', 'Overall game volume.', 'masterVolume', 0, 1, 0.01)}
                ${this.toggleRow('Music enabled', 'Allow ambient background music and ambience.', 'musicEnabled')}
                ${this.rangeRow('Music volume', 'Ambient background sound level.', 'musicVolume', 0, 1, 0.01)}
                ${this.toggleRow('Sound effects enabled', 'Allow building, UI and battle feedback sounds.', 'sfxEnabled')}
                ${this.rangeRow('Sound effects volume', 'Building, UI and battle feedback level.', 'sfxVolume', 0, 1, 0.01)}
                ${this.toggleRow('Mute all', 'Silence all game audio immediately.', 'muted')}
              </div>
            </section>

            <section class="settings-pane" data-settings-pane="gameplay">
              ${this.paneHeading('GAMEPLAY', 'Controls & Feedback', 'Adjust camera behavior and combat feedback.')}
              <div class="settings-control-card">
                ${this.selectRow('Control preference', 'Only changes controls and layout; graphics quality is configured separately.', 'controlScheme', '<option value="standard">Standard</option><option value="touch">Touch / Mobile</option>')}
                ${this.rangeRow('Camera sensitivity', 'Adjust orbit and camera response.', 'cameraSensitivity', 0.5, 2, 0.05)}
                ${this.toggleRow('Combat feedback', 'Enable battle feedback and battle sound cues.', 'combatFeedback')}
              </div>
            </section>

            <section class="settings-pane" data-settings-pane="accessibility">
              ${this.paneHeading('ACCESSIBILITY', 'Comfort & Visibility', 'Reduce motion and improve visual contrast.')}
              <div class="settings-control-card">
                ${this.toggleRow('Reduced motion', 'Minimize non-essential animation and smooth scrolling.', 'reducedMotion')}
                ${this.toggleRow('High contrast UI', 'Increase contrast on key interface surfaces.', 'highContrast')}
              </div>
            </section>

            <section class="settings-pane" data-settings-pane="controls">
              ${this.paneHeading('REFERENCE', 'Controls', 'A compact reference for desktop controls.')}
              <div class="settings-control-reference">
                <span><kbd>Esc</kbd><strong>Clear / Close</strong><small>Clear the active build tool or close help.</small></span>
                <span><kbd>Ctrl/Cmd + Z</kbd><strong>Undo</strong><small>Undo the latest architectural change.</small></span>
                <span><kbd>Ctrl/Cmd + Y</kbd><strong>Redo</strong><small>Restore the last undone change.</small></span>
                <span><kbd>1–0 · F · W · Y · A · T · N · M</kbd><strong>Build shortcuts</strong><small>Select common build tools directly.</small></span>
                <span><kbd>Mouse / Touch</kbd><strong>Camera</strong><small>Orbit, pan and zoom using the active view mode.</small></span>
              </div>
            </section>

            <section class="settings-pane" data-settings-pane="data">
              ${this.paneHeading('LOCAL DATA', 'Data & Privacy', 'Saves and settings are stored locally in this browser.')}
              <div class="settings-data-actions">
                <button type="button" data-action="open-privacy" disabled aria-busy="true"><span>Data & Privacy</span><small>Review what the game stores and how to delete it</small></button>
                <button type="button" data-action="defaults"><span>Restore defaults</span><small>Restore default settings without deleting saves</small></button>
                <button type="button" data-action="reset-settings"><span>Reset settings</span><small>Clear saved preferences and return to defaults</small></button>
                <button class="is-danger" type="button" data-action="reset-save"><span>Delete local saves</span><small>Remove all local save slots and autosaves</small></button>
              </div>
            </section>
          </div>
        </div>
      </div>`;

    return panel;
  }

  private navButton(pane: SettingsPane, icon: string, label: string, autofocus = false): string {
    return `<button type="button" class="settings-nav-button${pane === this.activePane ? ' is-active' : ''}" data-settings-nav="${pane}" aria-selected="${String(pane === this.activePane)}"${autofocus ? ' data-settings-autofocus' : ''}><span aria-hidden="true">${icon}</span><strong>${label}</strong></button>`;
  }

  private actionButton(action: SystemAction, icon: string, title: string, description: string): string {
    return `<button type="button" data-system-action="${action}"><span class="settings-action-icon" aria-hidden="true">${icon}</span><span class="settings-action-copy"><strong>${title}</strong><small>${description}</small></span><span aria-hidden="true">›</span></button>`;
  }

  private paneHeading(eyebrow: string, title: string, description: string): string {
    return `<div class="settings-pane-heading"><div><span class="settings-section-eyebrow">${eyebrow}</span><h3>${title}</h3><p>${description}</p></div></div>`;
  }

  private rangeRow(label: string, description: string, key: string, min: number, max: number, step: number): string {
    return `<label class="settings-control-row"><span class="settings-control-copy"><strong>${label}</strong><small>${description}</small></span><span class="settings-range-control"><input type="range" min="${min}" max="${max}" step="${step}" data-setting="${key}"><output data-setting-output="${key}">—</output></span></label>`;
  }

  private selectRow(label: string, description: string, key: string, options: string): string {
    return `<label class="settings-control-row"><span class="settings-control-copy"><strong>${label}</strong><small>${description}</small></span><select data-setting="${key}">${options}</select></label>`;
  }

  private toggleRow(label: string, description: string, key: string): string {
    return `<label class="settings-toggle-row"><span class="settings-control-copy"><strong>${label}</strong><small>${description}</small></span><span class="settings-toggle"><input type="checkbox" data-setting="${key}"><span aria-hidden="true"></span></span></label>`;
  }

  private bindOpenCloseActions(settingsButton: HTMLButtonElement): void {
    registerOpenSettings(() => this.open());
    settingsButton.addEventListener('click', (event) => {
      event.preventDefault();
      requestOpenSettings();
    });

    this.backdrop.addEventListener('click', () => this.close());
    this.panel.querySelector<HTMLButtonElement>('#settings-close')?.addEventListener('click', () => this.close());
    this.panel.addEventListener('click', (event) => {
      if (event.target === this.panel) this.close();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.panel.hidden) this.close();
    });
  }

  private bindNavigation(): void {
    this.panel.querySelectorAll<HTMLButtonElement>('[data-settings-nav]').forEach((button) => {
      button.addEventListener('click', () => {
        const pane = button.dataset.settingsNav as SettingsPane | undefined;
        if (pane) this.activatePane(pane);
      });
    });
  }

  private activatePane(pane: SettingsPane): void {
    this.activePane = pane;
    this.panel.querySelectorAll<HTMLElement>('[data-settings-pane]').forEach((section) => {
      section.classList.toggle('is-active', section.dataset.settingsPane === pane);
    });
    this.panel.querySelectorAll<HTMLButtonElement>('[data-settings-nav]').forEach((button) => {
      const active = button.dataset.settingsNav === pane;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    this.panel.querySelector<HTMLElement>('.settings-scroll')?.scrollTo({ top: 0, behavior: 'auto' });
  }

  private bindCoreControls(): void {
    // Reuse the desktop reset control so confirmation and world-mode selection stay authoritative.
    this.panel.querySelector('[data-action="reset-world"]')?.addEventListener('click', () => {
      const resetButton = document.getElementById('reset-button');
      if (!(resetButton instanceof HTMLButtonElement) || !resetButton.onclick) {
        const status = this.panel.querySelector<HTMLElement>('[data-settings-action-status] span:last-child');
        if (status) status.textContent = 'Game runtime is still initializing. Try again after the world appears.';
        return;
      }
      this.close();
      resetButton.click();
    });
    this.panel.querySelector('[data-action="reset-save"]')?.addEventListener('click', () => {
      if (window.confirm(translate('Delete all local game saves? Your settings will be kept. This cannot be undone.', resolveLocale(this.store.get().interface.language)))) this.onResetSave();
    });
    this.panel.querySelector('[data-action="defaults"]')?.addEventListener('click', () => this.store.restoreDefaults());
    this.panel.querySelector('[data-action="reset-settings"]')?.addEventListener('click', () => {
      if (window.confirm(translate('Reset all game settings to their initial defaults? Your game saves will not be deleted.', resolveLocale(this.store.get().interface.language)))) this.store.resetSettings();
    });

    this.panel.querySelectorAll<HTMLButtonElement>('[data-system-action]').forEach((button) => {
      button.addEventListener('click', () => this.openSystemAction(button.dataset.systemAction || ''));
    });

    this.panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-setting]').forEach((input) => {
      input.addEventListener('change', () => this.updateFromControl(input));
      input.addEventListener('input', () => {
        if (input instanceof HTMLInputElement && input.type === 'range') this.updateFromControl(input);
      });
    });
  }

  private async installOptionalSections(): Promise<void> {
    const privacyButton = this.panel.querySelector<HTMLButtonElement>('[data-action="open-privacy"]');

    try {
      const { PrivacyLegalUI } = await import('../core/PrivacyLegalUI');
      const privacySection = new PrivacyLegalUI({
        resetSettings: () => this.store.resetSettings(),
        deleteSaveData: () => this.onResetSave(),
        clearAllLocalData: () => {
          this.store.clearAllLocalData();
          window.location.reload();
        },
      }).getSection();

      const dataPane = this.panel.querySelector<HTMLElement>('[data-settings-pane="data"]');
      dataPane?.appendChild(privacySection);

      if (privacyButton) {
        privacyButton.disabled = false;
        privacyButton.removeAttribute('aria-busy');
        privacyButton.addEventListener('click', () => {
          this.activatePane('data');
          privacySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    } catch (error) {
      console.error('Optional Data & Privacy Settings section failed to initialize', error);
      if (privacyButton) {
        privacyButton.disabled = true;
        privacyButton.removeAttribute('aria-busy');
        privacyButton.title = 'Data & Privacy is unavailable';
      }
    }
  }

  private openSystemAction(action: string): void {
    if (!this.isSystemAction(action)) return;

    this.close();
    if (requestSystemAction(action)) return;

    this.open();
    const status = this.panel.querySelector<HTMLElement>('[data-settings-action-status] span:last-child');
    if (status) status.textContent = 'Game runtime is still initializing. Try again after the world appears.';
  }

  private isSystemAction(action: string): action is SystemAction {
    return action === 'help' || action === 'load' || action === 'save' || action === 'templates';
  }

  private updateFromControl(input: HTMLInputElement | HTMLSelectElement): void {
    const key = input.dataset.setting;
    if (!key) return;
    const value =
      input instanceof HTMLInputElement && input.type === 'checkbox'
        ? input.checked
        : input instanceof HTMLInputElement && input.type === 'range'
          ? Number(input.value)
          : input.value;

    switch (key) {
      case 'controlScheme':
        this.store.setGameplay({ controlScheme: value === 'touch' ? 'touch' : 'standard' });
        break;
      case 'cameraSensitivity':
        this.store.setGameplay({ cameraSensitivity: Number(value) });
        break;
      case 'combatFeedback':
        this.store.setGameplay({ combatFeedback: Boolean(value) });
        break;
      case 'quality':
        this.store.setGraphics({ quality: value === 'low' || value === 'medium' ? value : 'high' });
        break;
      case 'effectsEnabled':
        this.store.setGraphics({ effectsEnabled: Boolean(value) });
        break;
      case 'shadowsEnabled':
        this.store.setGraphics({ shadowsEnabled: Boolean(value) });
        break;
      case 'performanceMode':
        this.store.setGraphics({ performanceMode: value === 'auto' || value === 'performance' || value === 'quality' ? value : 'balanced' });
        break;
      case 'environmentDetail':
        this.store.setGraphics({ environmentDetail: value === 'low' || value === 'medium' ? value : 'high' });
        break;
      case 'debugMode':
        this.store.setGraphics({ debugMode: Boolean(value) });
        break;
      case 'masterVolume':
        this.store.setAudio({ masterVolume: Number(value) });
        break;
      case 'musicEnabled':
        this.store.setAudio({ musicEnabled: Boolean(value) });
        break;
      case 'musicVolume':
        this.store.setAudio({ musicVolume: Number(value) });
        break;
      case 'sfxEnabled':
        this.store.setAudio({ sfxEnabled: Boolean(value) });
        break;
      case 'sfxVolume':
        this.store.setAudio({ sfxVolume: Number(value) });
        break;
      case 'muted':
        this.store.setAudio({ muted: Boolean(value) });
        break;
      case 'uiScale':
        this.store.setInterface({ uiScale: Number(value) });
        break;
      case 'language':
        this.store.setInterface({ language: value === 'fa' ? 'fa' : value === 'en' ? 'en' : 'system' });
        break;
      case 'reducedMotion':
        this.store.setInterface({ reducedMotion: Boolean(value) });
        break;
      case 'highContrast':
        this.store.setInterface({ highContrast: Boolean(value) });
        break;
      case 'confirmDestructiveActions':
        this.store.setInterface({ confirmDestructiveActions: Boolean(value) });
        break;
      case 'showHelp':
        this.store.setInterface({ showHelp: Boolean(value) });
        break;
    }
  }

  private render(settings: SettingsData): void {
    const set = (key: string, value: string | boolean | number): void => {
      const input = this.panel.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-setting="${key}"]`);
      if (!input) return;
      if (input instanceof HTMLInputElement && input.type === 'checkbox') input.checked = Boolean(value);
      else input.value = String(value);

      const output = this.panel.querySelector<HTMLOutputElement>(`[data-setting-output="${key}"]`);
      if (output) output.textContent = this.formatOutput(key, Number(value));
    };

    set('controlScheme', settings.gameplay.controlScheme);
    set('cameraSensitivity', settings.gameplay.cameraSensitivity);
    set('combatFeedback', settings.gameplay.combatFeedback);
    set('quality', settings.graphics.quality);
    set('effectsEnabled', settings.graphics.effectsEnabled);
    set('shadowsEnabled', settings.graphics.shadowsEnabled);
    set('performanceMode', settings.graphics.performanceMode);
    set('environmentDetail', settings.graphics.environmentDetail);
    set('debugMode', settings.graphics.debugMode);
    set('masterVolume', settings.audio.masterVolume);
    set('musicEnabled', settings.audio.musicEnabled);
    set('musicVolume', settings.audio.musicVolume);
    set('sfxEnabled', settings.audio.sfxEnabled);
    set('sfxVolume', settings.audio.sfxVolume);
    set('muted', settings.audio.muted);
    set('uiScale', settings.interface.uiScale);
    set('language', settings.interface.language);
    set('reducedMotion', settings.interface.reducedMotion);
    set('highContrast', settings.interface.highContrast);
    set('confirmDestructiveActions', settings.interface.confirmDestructiveActions);
    set('showHelp', settings.interface.showHelp);
  }

  private formatOutput(key: string, value: number): string {
    if (key === 'cameraSensitivity') return value.toFixed(2) + '×';
    if (key === 'uiScale' || key === 'masterVolume' || key === 'musicVolume' || key === 'sfxVolume') {
      return Math.round(value * 100) + '%';
    }
    return String(value);
  }
}
