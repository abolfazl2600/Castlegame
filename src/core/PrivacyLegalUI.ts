import { APPLICATION_METADATA } from '../app/applicationMetadata';
import { t } from '../i18n/localization';

export interface PrivacyLegalActions {
  readonly resetSettings: () => void;
  readonly deleteSaveData: () => void;
  readonly clearAllLocalData: () => void;
}

export class PrivacyLegalUI {
  private readonly section: HTMLElement;

  constructor(private readonly actions: PrivacyLegalActions) {
    this.section = this.createSection();
    this.bind();
  }

  getSection(): HTMLElement {
    return this.section;
  }

  private createSection(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'settings-privacy-section';
    section.id = 'settings-privacy-legal';
    section.innerHTML = `
      <div class="privacy-section-heading">
        <div>
          <span class="settings-eyebrow">DATA & PRIVACY</span>
          <h3>Data & Privacy</h3>
        </div>
        <span class="privacy-build-badge">Stored on your device</span>
      </div>

      <nav class="privacy-subnav" aria-label="Data & Privacy sections">
        <button type="button" data-privacy-target="privacy-policy">Privacy Policy</button>
        <button type="button" data-privacy-target="data-storage">Your Data</button>
        <button type="button" data-privacy-target="clear-data">Delete Data</button>
        <button type="button" data-privacy-target="terms">Terms of Use</button>
        <button type="button" data-privacy-target="about">About</button>
      </nav>

      <div class="privacy-content">
        <article id="privacy-policy" class="privacy-document">
          <h4>Privacy Policy</h4>
          <p>Castle Role works without an account. In the current version, the game does not collect, sell, or share personal data with the developer or advertisers.</p>

          <h5>What stays on your device</h5>
          <ul>
            <li><strong>Game saves:</strong> your castle, world, progress, and save time.</li>
            <li><strong>Settings:</strong> your language, graphics, sound, gameplay, and interface preferences.</li>
          </ul>
          <p>This information is stored locally on your device. It is not sent to a Castle Role server.</p>

          <h5>What we do not collect</h5>
          <p>The current version does not collect your name, email, phone number, location, contacts, photos, advertising ID, gameplay analytics, or crash reports.</p>

          <h5>Sharing with others</h5>
          <p>Castle Role does not use advertising, analytics, or sign-in services in this version, and it does not share user data with third parties.</p>

          <h5>How long data is kept</h5>
          <p>Local game data stays on your device until you delete it from the game or clear the app or site data. Castle Role has no online account or server copy of your save to delete.</p>

          <h5>Data security</h5>
          <p>Because the game does not upload personal data to a Castle Role server, there is no server-side personal data store. Local data is protected by the security and access controls of your device, app, and browser.</p>

          <h5>Privacy questions</h5>
          <p>For privacy questions, use the developer contact listed on Castle Role's Google Play page.</p>
        </article>

        <article id="data-storage" class="privacy-document">
          <h4>Your Data</h4>
          <div class="privacy-data-card">
            <strong>Game saves</strong>
            <span>Stored only on this device</span>
            <small>Used to continue your saved world and progress.</small>
          </div>
          <div class="privacy-data-card">
            <strong>Settings</strong>
            <span>Stored only on this device</span>
            <small>Used to remember your game and interface preferences.</small>
          </div>
          <div class="privacy-data-card">
            <strong>Data sent to Castle Role servers</strong>
            <span>None in the current version</span>
            <small>No game account, advertising, analytics, or crash-reporting service is configured.</small>
          </div>
          <p>If the way Castle Role handles data changes in a future version, this page should be updated to match the app's actual behavior.</p>
        </article>

        <article id="clear-data" class="privacy-document">
          <h4>Delete Data</h4>
          <p>You can remove local game data at any time. The game asks for confirmation before permanent deletion.</p>

          <div class="privacy-danger-card">
            <div>
              <strong>Reset Settings</strong>
              <span>Restores default settings. Your saved game is kept.</span>
            </div>
            <button type="button" class="secondary-button" data-local-action="reset-settings">Reset Settings</button>
          </div>

          <div class="privacy-danger-card">
            <div>
              <strong>Delete Save Data</strong>
              <span>Deletes your saved world. Your settings are kept.</span>
            </div>
            <button type="button" class="danger-button" data-local-action="delete-save">Delete Save Data</button>
          </div>

          <div class="privacy-danger-card">
            <div>
              <strong>Clear All Local Game Data</strong>
              <span>Deletes the save, settings, and old Castle Role privacy preference data stored by the game.</span>
            </div>
            <button type="button" class="danger-button" data-local-action="clear-all">Clear All</button>
          </div>
        </article>

        <article id="terms" class="privacy-document">
          <h4>Terms of Use</h4>
          <ul>
            <li>Use Castle Role only in ways allowed by applicable law.</li>
            <li>Local saves can be lost if you delete app or site data.</li>
            <li>Game features and these terms may change as the game is updated.</li>
            <li>Nothing here limits rights you may have under applicable law.</li>
          </ul>
        </article>

        <article id="about" class="privacy-document">
          <h4>About</h4>
          <div class="privacy-about-grid">
            <div><span>Game</span><strong>${APPLICATION_METADATA.name}</strong></div>
            <div><span>Version</span><strong>${APPLICATION_METADATA.version}</strong></div>
          </div>
          <p>Castle Role is a 3D castle-building game. This page describes the data practices of the current version.</p>
          <p>Privacy contact: use the developer contact shown on the Google Play listing.</p>
        </article>
      </div>
    `;

    return section;
  }

  private bind(): void {
    this.section.querySelectorAll<HTMLButtonElement>('[data-privacy-target]').forEach((button) => {
      button.addEventListener('click', () => {
        const targetId = button.dataset.privacyTarget;
        const target = targetId ? this.section.querySelector<HTMLElement>(`#${targetId}`) : null;
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    this.section.querySelector<HTMLButtonElement>('[data-local-action="reset-settings"]')?.addEventListener('click', () => {
      if (!window.confirm(t('Reset all Castle Role settings to their defaults? Your game save will not be deleted.'))) return;
      this.actions.resetSettings();
    });

    this.section.querySelector<HTMLButtonElement>('[data-local-action="delete-save"]')?.addEventListener('click', () => {
      if (!window.confirm(t('Delete the Castle Role game save? Your settings will be kept. This cannot be undone.'))) return;
      this.actions.deleteSaveData();
    });

    this.section.querySelector<HTMLButtonElement>('[data-local-action="clear-all"]')?.addEventListener('click', () => {
      if (!window.confirm(t('Clear all Castle Role local game data? This deletes the save, settings, and legacy Castle Role privacy data. This cannot be undone.'))) return;
      this.actions.clearAllLocalData();
    });
  }
}
