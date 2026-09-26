import { APPLICATION_METADATA } from '../app/applicationMetadata';

const SAVE_STORAGE_KEY = 'castle-role-save-v1';
const SETTINGS_STORAGE_KEY = 'castle-role.settings.v2';
const LEGACY_PRIVACY_STORAGE_KEY = 'castle-role:privacy-consent:v1';

export interface PrivacyLegalActions {
  readonly resetSettings: () => void;
  readonly deleteSaveData: () => void;
  readonly clearAllLocalData: () => void;
}

export class PrivacyLegalUI {
  private readonly section: HTMLElement;

  constructor(private readonly actions: PrivacyLegalActions) {
    this.section = this.createSection();
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
          <span class="settings-eyebrow">PRIVACY & LEGAL</span>
          <h3>Privacy & Legal</h3>
        </div>
        <span class="privacy-build-badge">Local-first</span>
      </div>

      <nav class="privacy-subnav" aria-label="Privacy & Legal sections">
        <button type="button" data-privacy-target="privacy-policy">Privacy Policy</button>
        <button type="button" data-privacy-target="data-storage">Data & Storage</button>
        <button type="button" data-privacy-target="clear-data">Clear Local Data</button>
        <button type="button" data-privacy-target="terms">Terms of Use</button>
        <button type="button" data-privacy-target="licenses">Open Source & Licenses</button>
        <button type="button" data-privacy-target="about">About</button>
      </nav>

      <div class="privacy-content">
        <article id="privacy-policy" class="privacy-document">
          <h4>Privacy Policy</h4>
          <p>This information describes the behavior implemented in the current Castle Role web application. It is intended as player-facing product information, not legal advice.</p>

          <h5>Information stored by the game</h5>
          <ul>
            <li><strong>Game saves:</strong> the current game save is stored in this browser's local storage under <code>castle-role-save-v1</code>. The saved game contains game state such as constructed cells, Keep data, terrain overrides, elevation edits, game mode, style information, bridge data, seed state, and a save timestamp.</li>
            <li><strong>Settings:</strong> gameplay, graphics, audio, and interface preferences are stored locally under <code>castle-role.settings.v2</code>. The application can migrate the previous <code>castle-role.settings.v1</code> key when present.</li>
            <li><strong>Other application data:</strong> the inspected application currently has no additional application-managed persistent data store configured. An older privacy-consent key may exist from a previous build; Clear All Local Game Data removes it.</li>
          </ul>

          <h5>Analytics, telemetry, and crash reporting</h5>
          <p>No analytics or crash-reporting integration is configured in the application. The current repository contains no configured analytics or telemetry service used by the game. The game therefore does not provide an in-game analytics or crash-reporting collection mechanism in this build.</p>

          <h5>External services and personal information</h5>
          <p>The application code does not define an account system, sign-in flow, personal-information form, or application-managed user profile. The runtime dependency is Three.js, which is bundled as an application dependency rather than configured as an analytics or account service. No application API or telemetry endpoint is configured in the inspected runtime code.</p>

          <h5>Cookies</h5>
          <p>The inspected application does not create or manage cookies. Local game saves and settings use browser local storage instead.</p>

          <h5>Deleting local data</h5>
          <p>Use the controls below to remove game-managed local data. Clearing the browser's site data for the game's origin can also remove local saves and settings, depending on the browser. Browser-level clearing may remove other site data that the browser associates with the same origin; the controls in this game are limited to the storage keys used by Castle Role.</p>
        </article>

        <article id="data-storage" class="privacy-document">
          <h4>Data & Storage</h4>
          <div class="privacy-data-card">
            <strong>Game saves</strong>
            <span>Local browser storage · <code>castle-role-save-v1</code></span>
            <small>Deleting this key removes the saved castle/world state. It does not remove settings.</small>
          </div>
          <div class="privacy-data-card">
            <strong>Settings</strong>
            <span>Local browser storage · <code>castle-role.settings.v2</code></span>
            <small>Resetting settings restores defaults without deleting the game save.</small>
          </div>
          <div class="privacy-data-card">
            <strong>Other local application data</strong>
            <span>No current additional persistent store identified</span>
            <small>Clear All also removes the legacy privacy-consent key from older builds if it is present.</small>
          </div>
          <p>Clearing the browser's site data can remove both the save and settings because both are stored locally in the browser. It may also affect unrelated data stored by other applications under the same browser origin rules, so use the in-game controls when you only want to remove Castle Role data.</p>
        </article>

        <article id="clear-data" class="privacy-document">
          <h4>Clear Local Data</h4>
          <p>Each action is deliberately separate. A confirmation dialog is shown immediately before destructive deletion.</p>

          <div class="privacy-danger-card">
            <div>
              <strong>Reset Settings</strong>
              <span>Restores gameplay, graphics, audio, and interface settings to their defaults. Your game save is kept.</span>
            </div>
            <button type="button" class="secondary-button" data-local-action="reset-settings">Reset Settings</button>
          </div>

          <div class="privacy-danger-card">
            <div>
              <strong>Delete Save Data</strong>
              <span>Deletes the Castle Role game save from local storage. Your settings are kept.</span>
            </div>
            <button type="button" class="danger-button" data-local-action="delete-save">Delete Save Data</button>
          </div>

          <div class="privacy-danger-card">
            <div>
              <strong>Clear All Local Game Data</strong>
              <span>Deletes the Castle Role save, settings, and any legacy Castle Role privacy-consent data. It does not clear unrelated browser storage.</span>
            </div>
            <button type="button" class="danger-button" data-local-action="clear-all">Clear All</button>
          </div>
        </article>

        <article id="terms" class="privacy-document">
          <h4>Terms of Use</h4>
          <p>These concise terms describe use of the current Castle Role game build. They are not lawyer-reviewed legal advice.</p>
          <ol>
            <li><strong>Use of the game.</strong> Use Castle Role only in ways permitted by applicable law and the rights attached to the game and its included third-party components.</li>
            <li><strong>Local data.</strong> Saves and settings are maintained in the player's browser. The player is responsible for maintaining any local backup they may need.</li>
            <li><strong>Changes.</strong> Game features, storage formats, documentation, and these terms may change as the project evolves.</li>
            <li><strong>Third-party software.</strong> Third-party libraries and assets remain subject to their own licenses and notices.</li>
            <li><strong>No legal status claim.</strong> Nothing in this section states that the project complies with a particular privacy, consumer-protection, accessibility, or other legal regime.</li>
          </ol>
        </article>

        <article id="licenses" class="privacy-document">
          <h4>Open Source & Licenses</h4>
          <h5>Project license</h5>
          <p>No root <code>LICENSE</code> file and no project <code>license</code> field were identified in the repository. The game therefore does not display an invented project license here.</p>

          <h5>Third-party dependencies</h5>
          <ul>
            <li><strong>three 0.180.0</strong> — runtime dependency listed in <code>package.json</code>. Three.js is distributed under the MIT License by its upstream project.</li>
            <li><strong>TypeScript</strong> and <strong>Vite</strong> — development/build dependencies listed in <code>package.json</code>; they are not runtime game services.</li>
          </ul>

          <h5>Assets and notices</h5>
          <p>The repository contains procedural game rendering code and store-asset placeholder directories. No separate third-party game-asset attribution notice was identified in the inspected project files. Any future externally sourced asset should retain and expose its required attribution and license notice before distribution.</p>

          <p class="privacy-note">License information should be reviewed against the exact dependency versions and any future asset additions before a release is distributed.</p>
        </article>

        <article id="about" class="privacy-document">
          <h4>About</h4>
          <div class="privacy-about-grid">
            <div><span>Game</span><strong>Castle Role</strong></div>
            <div><span>Version</span><strong>0.2.0</strong></div>
            <div><span>Save format</span><strong>v10</strong></div>
            <div><span>Technology</span><strong>Three.js · TypeScript · Vite</strong></div>
          </div>
          <p>Castle Role is a browser-based 3D stronghold builder with editable terrain, settlement, castle architecture, and battle systems.</p>
          <p>Developer and support contact details are not configured in the current application metadata, so none are displayed here.</p>
          <p>Open-source and dependency information is summarized in the Open Source & Licenses section and should be updated when project dependencies, assets, or licensing change.</p>
        </article>
      </div>
    `;

    this.bind();
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
      if (!window.confirm('Reset all Castle Role settings to their defaults? Your game save will not be deleted.')) return;
      this.actions.resetSettings();
    });

    this.section.querySelector<HTMLButtonElement>('[data-local-action="delete-save"]')?.addEventListener('click', () => {
      if (!window.confirm('Delete the Castle Role game save? Your settings will be kept. This cannot be undone.')) return;
      this.actions.deleteSaveData();
    });

    this.section.querySelector<HTMLButtonElement>('[data-local-action="clear-all"]')?.addEventListener('click', () => {
      if (!window.confirm('Clear all Castle Role local game data? This deletes the save, settings, and legacy Castle Role privacy data. This cannot be undone.')) return;
      this.actions.clearAllLocalData();
    });
  }
}
