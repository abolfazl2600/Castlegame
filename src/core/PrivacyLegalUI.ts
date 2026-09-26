import {
  getConfiguredExternalUrl,
  PRIVACY_LEGAL_CONFIG,
  type DataCollectionCapability,
  type ExternalLinkKey,
} from './PrivacyConfig';
import { PrivacyConsentStore, type ConsentState } from './PrivacyConsentStore';

const MODAL_ID = 'privacy-legal-modal';

function consentLabel(value: ConsentState): string {
  if (value === 'granted') return 'Granted';
  if (value === 'denied') return 'Denied';
  return 'Not set';
}

function integrationLabel(capability: DataCollectionCapability): string {
  return capability.integrationStatus === 'integrated' ? 'Integrated' : 'Not configured';
}

export class PrivacyLegalUI {
  private readonly store = new PrivacyConsentStore();
  private readonly modal: HTMLElement;

  constructor() {
    this.modal = this.createModal();
    document.body.appendChild(this.modal);

    const privacyButton = document.getElementById('privacy-button');
    privacyButton?.addEventListener('click', () => this.open());

    this.bind();
    this.render();
  }

  private createModal(): HTMLElement {
    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'modal-backdrop';
    modal.hidden = true;
    modal.innerHTML =
      '<section class="help-modal privacy-modal" role="dialog" aria-modal="true" aria-labelledby="privacy-title">' +
      '<div class="help-modal-header">' +
      '<div><div class="eyebrow">CASTLE ROLE · PRIVACY</div><h2 id="privacy-title">Privacy & Legal</h2></div>' +
      '<button id="privacy-close-button" class="icon-button" type="button" aria-label="Close privacy settings">×</button>' +
      '</div>' +
      '<div class="privacy-links">' +
      '<div class="privacy-section-title">Documents</div>' +
      '<button class="privacy-link-button" type="button" data-privacy-link="privacyPolicy">Privacy Policy</button>' +
      '<button class="privacy-link-button" type="button" data-privacy-link="termsOfService">Terms of Service</button>' +
      '<button class="privacy-link-button" type="button" data-privacy-link="support">Support</button>' +
      '<button class="privacy-link-button" type="button" data-privacy-link="developerWebsite">Developer website</button>' +
      '</div>' +
      '<div class="privacy-disclosure">' +
      '<div class="privacy-section-title">Data collection controls</div>' +
      '<div id="privacy-capabilities" class="privacy-capabilities"></div>' +
      '</div>' +
      '<div class="privacy-developer" id="privacy-developer"></div>' +
      '<div class="privacy-footer">' +
      '<span id="privacy-status" class="privacy-status" aria-live="polite"></span>' +
      '<button id="privacy-reset-button" class="secondary-button" type="button">Reset choices</button>' +
      '</div>' +
      '</section>';
    return modal;
  }

  private bind(): void {
    document.getElementById('privacy-close-button')?.addEventListener('click', () => this.close());

    this.modal.addEventListener('click', (event) => {
      if (event.target === this.modal) this.close();
    });

    this.modal.querySelectorAll<HTMLButtonElement>('[data-privacy-link]').forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.dataset.privacyLink as ExternalLinkKey | undefined;
        if (key) this.openExternalLink(key);
      });
    });

    document.getElementById('privacy-reset-button')?.addEventListener('click', () => {
      this.store.reset();
      this.render();
      this.setStatus('Privacy choices reset.');
    });
  }

  private render(): void {
    const state = this.store.get();
    const capabilities = document.getElementById('privacy-capabilities');
    if (capabilities) {
      capabilities.innerHTML = PRIVACY_LEGAL_CONFIG.dataCollection
        .map(
          (capability) =>
            '<div class="privacy-capability">' +
            '<div class="privacy-capability-copy">' +
            '<strong>' +
            capability.label +
            '</strong>' +
            '<small>Integration: ' +
            integrationLabel(capability) +
            '</small>' +
            '</div>' +
            '<div class="privacy-consent-controls">' +
            '<span class="privacy-consent-state">' +
            consentLabel(state[capability.consentKey]) +
            '</span>' +
            '<button type="button" data-consent="' +
            capability.consentKey +
            '" data-value="granted">Allow</button>' +
            '<button type="button" data-consent="' +
            capability.consentKey +
            '" data-value="denied">Decline</button>' +
            '</div>' +
            '</div>',
        )
        .join('');

      capabilities.querySelectorAll<HTMLButtonElement>('[data-consent]').forEach((button) => {
        button.addEventListener('click', () => {
          const key = button.dataset.consent;
          const value = button.dataset.value;
          if (key === 'analytics' && isConsentState(value)) {
            this.store.setAnalytics(value);
          } else if (key === 'crashReporting' && isConsentState(value)) {
            this.store.setCrashReporting(value);
          } else {
            return;
          }
          this.render();
          this.setStatus('Privacy choice saved.');
        });
      });
    }

    const developer = document.getElementById('privacy-developer');
    if (developer) {
      const info = PRIVACY_LEGAL_CONFIG.developer;
      const entries = [
        info.name ? '<span>' + this.escapeHtml(info.name) + '</span>' : '',
        info.websiteUrl ? '<span>Website configured</span>' : '',
        info.contactUrl ? '<span>Contact configured</span>' : '',
      ].filter(Boolean);
      developer.innerHTML = entries.length
        ? '<div class="privacy-section-title">Developer information</div><div class="privacy-developer-values">' +
          entries.join('') +
          '</div>'
        : '';
    }

    this.modal.querySelectorAll<HTMLButtonElement>('[data-privacy-link]').forEach((button) => {
      const key = button.dataset.privacyLink as ExternalLinkKey | undefined;
      button.disabled = !key || !getConfiguredExternalUrl(key);
    });
  }

  private openExternalLink(key: ExternalLinkKey): void {
    const url = getConfiguredExternalUrl(key);
    if (!url) {
      this.setStatus('Link not configured.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  private open(): void {
    this.render();
    this.modal.hidden = false;
  }

  private close(): void {
    this.modal.hidden = true;
  }

  private setStatus(message: string): void {
    const status = document.getElementById('privacy-status');
    if (status) status.textContent = message;
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return entities[character] ?? character;
    });
  }
}

function isConsentState(value: string | undefined): value is ConsentState {
  return value === 'unknown' || value === 'granted' || value === 'denied';
}
