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
    this.render(this.store.get());
    this.store.subscribe((settings) => this.render(settings));
  }

  open(): void {
    this.panel.hidden = false;
  }

  private createPanel(): HTMLElement {
    const panel = document.createElement('section');
    panel.id = 'settings-modal';
    panel.className = 'settings-modal';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="settings-card" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header class="settings-header">
          <div><span class="settings-eyebrow">SYSTEM</span><h2 id="settings-title">Settings</h2></div>
          <button id="settings-close" type="button" aria-label="Close settings">×</button>
        </header>
        <div class="settings-scroll">
          <section><h3>Gameplay</h3>
            <label>Control preference<select data-setting="controlScheme"><option value="standard">Standard</option><option value="touch">Touch / Mobile</option></select></label>
            <label><input type="checkbox" data-setting="tutorialCompleted"> Tutorial completed</label>
          </section>
          <section><h3>Graphics</h3>
            <label>Quality<select data-setting="quality"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
            <label><input type="checkbox" data-setting="effectsEnabled"> Effects</label>
            <label><input type="checkbox" data-setting="shadowsEnabled"> Shadows</label>
            <label>Performance mode<select data-setting="performanceMode"><option value="performance">Performance</option><option value="balanced">Balanced</option><option value="quality">Quality</option></select></label>
          </section>
          <section><h3>Audio</h3>
            <label>Master <input type="range" min="0" max="1" step="0.01" data-setting="masterVolume"></label>
            <label>Music <input type="range" min="0" max="1" step="0.01" data-setting="musicVolume"></label>
            <label>SFX <input type="range" min="0" max="1" step="0.01" data-setting="sfxVolume"></label>
            <label><input type="checkbox" data-setting="muted"> Mute</label>
          </section>
          <section><h3>Interface</h3>
            <label>UI scale <input type="range" min="0.75" max="1.5" step="0.05" data-setting="uiScale"></label>
            <label>Language<select data-setting="language"><option value="system">System (placeholder)</option><option value="en">English</option></select></label>
            <label><input type="checkbox" data-setting="reducedMotion"> Reduced motion</label>
            <label><input type="checkbox" data-setting="highContrast"> High contrast</label>
          </section>
          <section><h3>Data</h3>
            <button type="button" data-action="reset-save">Reset local save</button>
            <button type="button" data-action="defaults">Restore default settings</button>
          </section>
        </div>
      </div>`;
    panel.querySelector<HTMLButtonElement>('#settings-close')?.addEventListener('click', () => { panel.hidden = true; });
    panel.addEventListener('click', (event) => {
      if (event.target === panel) panel.hidden = true;
    });
    panel.querySelector('[data-action="reset-save"]')?.addEventListener('click', () => {
      if (confirm('Delete the local game save? This cannot be undone.')) this.onResetSave();
    });
    panel.querySelector('[data-action="defaults"]')?.addEventListener('click', () => this.store.restoreDefaults());
    panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-setting]').forEach((input) => {
      input.addEventListener('change', () => this.updateFromControl(input));
      input.addEventListener('input', () => {
        if (input instanceof HTMLInputElement && input.type === 'range') this.updateFromControl(input);
      });
    });
    return panel;
  }

  private updateFromControl(input: HTMLInputElement | HTMLSelectElement): void {
    const key = input.dataset.setting;
    if (!key) return;
    const value = input instanceof HTMLInputElement && input.type === 'checkbox'
      ? input.checked
      : input instanceof HTMLInputElement && input.type === 'range'
        ? Number(input.value)
        : input.value;
    if (key === 'controlScheme') this.store.setGameplay({ controlScheme: value === 'touch' ? 'touch' : 'standard' });
    else if (key === 'tutorialCompleted') this.store.setGameplay({ tutorialCompleted: Boolean(value) });
    else if (key === 'quality') this.store.setGraphics({ quality: value === 'low' || value === 'medium' ? value : 'high' });
    else if (key === 'effectsEnabled') this.store.setGraphics({ effectsEnabled: Boolean(value) });
    else if (key === 'shadowsEnabled') this.store.setGraphics({ shadowsEnabled: Boolean(value) });
    else if (key === 'performanceMode') this.store.setGraphics({ performanceMode: value === 'performance' || value === 'quality' ? value : 'balanced' });
    else if (key === 'masterVolume') this.store.setAudio({ masterVolume: Number(value) });
    else if (key === 'musicVolume') this.store.setAudio({ musicVolume: Number(value) });
    else if (key === 'sfxVolume') this.store.setAudio({ sfxVolume: Number(value) });
    else if (key === 'muted') this.store.setAudio({ muted: Boolean(value) });
    else if (key === 'uiScale') this.store.setInterface({ uiScale: Number(value) });
    else if (key === 'language') this.store.setInterface({ language: value === 'en' ? 'en' : 'system' });
    else if (key === 'reducedMotion') this.store.setInterface({ reducedMotion: Boolean(value) });
    else if (key === 'highContrast') this.store.setInterface({ highContrast: Boolean(value) });
  }

  private render(settings: SettingsData): void {
    const set = (key: string, value: string | boolean | number): void => {
      const input = this.panel.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-setting="${key}"]`);
      if (!input) return;
      if (input instanceof HTMLInputElement && input.type === 'checkbox') input.checked = Boolean(value);
      else input.value = String(value);
    };
    set('controlScheme', settings.gameplay.controlScheme);
    set('tutorialCompleted', settings.gameplay.tutorialCompleted);
    set('quality', settings.graphics.quality);
    set('effectsEnabled', settings.graphics.effectsEnabled);
    set('shadowsEnabled', settings.graphics.shadowsEnabled);
    set('performanceMode', settings.graphics.performanceMode);
    set('masterVolume', settings.audio.masterVolume);
    set('musicVolume', settings.audio.musicVolume);
    set('sfxVolume', settings.audio.sfxVolume);
    set('muted', settings.audio.muted);
    set('uiScale', settings.interface.uiScale);
    set('language', settings.interface.language);
    set('reducedMotion', settings.interface.reducedMotion);
    set('highContrast', settings.interface.highContrast);
  }
}
