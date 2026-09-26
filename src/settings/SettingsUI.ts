import { PrivacyLegalUI } from '../core/PrivacyLegalUI';
import type { SettingsStore } from './SettingsStore';
import type { SettingsData } from './SettingsModel';

export class SettingsUI {
  private readonly panel: HTMLElement;

  constructor(
    private readonly store: SettingsStore,
    private readonly onResetSave: () => void,
  ) {
    this.panel = this.createPanel();
    document.body.appendChild(this.panel);
    document.getElementById('settings-button')?.addEventListener('click', () => this.open());
    this.store.subscribe((settings) => this.render(settings));
  }

  open(): void {
    this.panel.hidden = false;
    this.panel.querySelector<HTMLElement>('[data-settings-autofocus]')?.focus();
  }

  close(): void {
    this.panel.hidden = true;
  }

  private createPanel(): HTMLElement {
    const panel = document.createElement('section');
    panel.id = 'settings-modal';
    panel.className = 'settings-modal';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="settings-card" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header class="settings-header">
          <div><span class="settings-eyebrow">SYSTEM</span><h2 id="settings-title">Game Settings</h2></div>
          <button id="settings-close" type="button" aria-label="Close settings">×</button>
        </header>
        <div class="settings-scroll">
          <section>
            <h3>General</h3>
            <label>Language<select data-setting="language"><option value="system">System language</option><option value="en">English</option></select></label>
            <label>UI scale<input type="range" min="0.75" max="1.5" step="0.05" data-setting="uiScale"></label>
            <label><input type="checkbox" data-setting="confirmDestructiveActions"> Confirm destructive actions</label>
            <label><input type="checkbox" data-setting="showHelp"> Show help</label>
          </section>

          <section>
            <h3>Graphics</h3>
            <label>Graphics quality<select data-setting="quality"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
            <label>Performance mode<select data-setting="performanceMode"><option value="performance">Performance</option><option value="balanced">Balanced</option><option value="quality">Quality</option></select></label>
            <label>Environment detail<select data-setting="environmentDetail"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
            <label><input type="checkbox" data-setting="shadowsEnabled"> Shadows</label>
            <label><input type="checkbox" data-setting="effectsEnabled"> Visual effects</label>
          </section>

          <section>
            <h3>Audio</h3>
            <label>Master volume<input type="range" min="0" max="1" step="0.01" data-setting="masterVolume"></label>
            <label>Music volume<input type="range" min="0" max="1" step="0.01" data-setting="musicVolume"></label>
            <label>SFX volume<input type="range" min="0" max="1" step="0.01" data-setting="sfxVolume"></label>
            <label><input type="checkbox" data-setting="muted"> Mute all</label>
          </section>

          <section>
            <h3>Gameplay</h3>
            <label>Control preference<select data-setting="controlScheme"><option value="standard">Standard</option><option value="touch">Touch / Mobile</option></select></label>
            <label>Camera sensitivity<input type="range" min="0.5" max="2" step="0.05" data-setting="cameraSensitivity"></label>
            <label><input type="checkbox" data-setting="combatFeedback"> Combat feedback</label>
          </section>

          <section>
            <h3>Accessibility</h3>
            <label><input type="checkbox" data-setting="reducedMotion"> Reduced motion / animation</label>
            <label><input type="checkbox" data-setting="highContrast"> High contrast UI</label>
          </section>

          <section>
            <h3>Controls</h3>
            <div class="settings-control-reference">
              <span><kbd>Esc</kbd> Clear the active build tool / close help.</span>
              <span><kbd>Ctrl/Cmd + Z</kbd> Undo</span>
              <span><kbd>Ctrl/Cmd + Y</kbd> Redo</span>
              <span><kbd>1–0, F, W, Y, A, T, N, M, Q, R, L, P, D, I, O, K, U, J, B, V, G, H, C, X</kbd> Select the corresponding build tools.</span>
              <span>Mouse / touch drag and OrbitControls provide camera interaction. Rebinding is not exposed because the current input architecture has no safe rebinding layer.</span>
            </div>
          </section>

          <section>
            <h3>Data</h3>
            <p class="settings-section-note">Game saves and settings are stored locally in your browser.</p>
            <button type="button" data-action="open-privacy">Privacy & Legal</button>
            <button type="button" data-action="reset-save">Reset local save</button>
            <button type="button" data-action="defaults">Restore default settings</button>
            <button type="button" data-action="reset-settings">Reset settings</button>
          </section>
        </div>
      </div>`;
    
    const privacySection = new PrivacyLegalUI({
      resetSettings: () => this.store.resetSettings(),
      deleteSaveData: () => this.onResetSave(),
      clearAllLocalData: () => {
        this.store.clearAllLocalData();
        window.location.reload();
      },
    }).getSection();
    panel.querySelector('.settings-scroll')?.appendChild(privacySection);

    panel.querySelector<HTMLButtonElement>('#settings-close')?.addEventListener('click', () => this.close());
    panel.addEventListener('click', (event) => {
      if (event.target === panel) this.close();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.panel.hidden) this.close();
    });

    panel.querySelector('[data-action="open-privacy"]')?.addEventListener('click', () => {
      privacySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    panel.querySelector('[data-action="reset-save"]')?.addEventListener('click', () => {
      if (this.confirmDestructive('Delete the local game save? This cannot be undone.')) this.onResetSave();
    });
    panel.querySelector('[data-action="defaults"]')?.addEventListener('click', () => this.store.restoreDefaults());
    panel.querySelector('[data-action="reset-settings"]')?.addEventListener('click', () => {
      if (this.confirmDestructive('Reset all game settings to their initial defaults? Your game save will not be deleted.')) this.store.resetSettings();
    });

    panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-setting]').forEach((input) => {
      input.addEventListener('change', () => this.updateFromControl(input));
      input.addEventListener('input', () => {
        if (input instanceof HTMLInputElement && input.type === 'range') this.updateFromControl(input);
      });
    });

    return panel;
  }

  private confirmDestructive(message: string): boolean {
    return !this.store.get().interface.confirmDestructiveActions || window.confirm(message);
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
        this.store.setGraphics({ performanceMode: value === 'performance' || value === 'quality' ? value : 'balanced' });
        break;
      case 'environmentDetail':
        this.store.setGraphics({ environmentDetail: value === 'low' || value === 'medium' ? value : 'high' });
        break;
      case 'masterVolume':
        this.store.setAudio({ masterVolume: Number(value) });
        break;
      case 'musicVolume':
        this.store.setAudio({ musicVolume: Number(value) });
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
        this.store.setInterface({ language: value === 'en' ? 'en' : 'system' });
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
    };

    set('controlScheme', settings.gameplay.controlScheme);
    set('cameraSensitivity', settings.gameplay.cameraSensitivity);
    set('combatFeedback', settings.gameplay.combatFeedback);
    set('quality', settings.graphics.quality);
    set('effectsEnabled', settings.graphics.effectsEnabled);
    set('shadowsEnabled', settings.graphics.shadowsEnabled);
    set('performanceMode', settings.graphics.performanceMode);
    set('environmentDetail', settings.graphics.environmentDetail);
    set('masterVolume', settings.audio.masterVolume);
    set('musicVolume', settings.audio.musicVolume);
    set('sfxVolume', settings.audio.sfxVolume);
    set('muted', settings.audio.muted);
    set('uiScale', settings.interface.uiScale);
    set('language', settings.interface.language);
    set('reducedMotion', settings.interface.reducedMotion);
    set('highContrast', settings.interface.highContrast);
    set('confirmDestructiveActions', settings.interface.confirmDestructiveActions);
    set('showHelp', settings.interface.showHelp);
  }
}
