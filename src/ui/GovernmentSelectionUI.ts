import { getCurrentLocale } from '../i18n/localization';
import {
  GOVERNMENTS,
  governmentDefinition,
  normalizeGovernmentState,
  type GovernmentState,
} from '../systems/GovernmentSystem';
import './GovernmentSelectionUI.css';

const localized = (fa: string, en: string): string => getCurrentLocale() === 'fa' ? fa : en;

export class GovernmentSelectionUI {
  private modal: HTMLElement | null = null;
  private hud: HTMLElement | null = null;
  private onConfirm: ((state: GovernmentState) => void) | null = null;
  private onBack: (() => void) | null = null;

  mount(): void {
    if (this.modal || typeof document === 'undefined') return;

    const hud = document.createElement('div');
    hud.id = 'government-hud';
    hud.className = 'government-hud';
    hud.setAttribute('role', 'status');
    document.body.appendChild(hud);
    this.hud = hud;

    const backdrop = document.createElement('div');
    backdrop.id = 'government-modal';
    backdrop.className = 'government-modal';
    backdrop.hidden = true;
    backdrop.innerHTML =
      '<form class="government-dialog" role="dialog" aria-modal="true" aria-labelledby="government-title">' +
      '<span class="government-eyebrow" data-government-eyebrow></span>' +
      '<h2 id="government-title"></h2>' +
      '<p data-government-description></p>' +
      '<fieldset class="government-options"><legend data-government-legend></legend><div class="government-option-list"></div></fieldset>' +
      '<label class="government-name-label" for="government-realm-name"></label>' +
      '<input id="government-realm-name" type="text" maxlength="40" autocomplete="off" />' +
      '<div class="government-actions"><button id="government-back-button" type="button" data-government-back></button>' +
      '<button type="submit" data-government-confirm></button></div>' +
      '</form>';
    const list = backdrop.querySelector<HTMLElement>('.government-option-list');
    for (const entry of GOVERNMENTS) {
      const label = document.createElement('label');
      label.className = 'government-option';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'government-kind';
      radio.value = entry.kind;
      if (entry.kind === 'kingdom') radio.checked = true;
      const symbol = document.createElement('span');
      symbol.className = 'government-option-symbol';
      symbol.textContent = entry.symbol;
      symbol.style.backgroundColor = '#' + entry.flagColor.toString(16).padStart(6, '0');
      const text = document.createElement('span');
      text.className = 'government-option-name';
      text.setAttribute('data-government-kind', entry.kind);
      label.append(radio, symbol, text);
      list?.appendChild(label);
    }

    backdrop.querySelector<HTMLFormElement>('form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const selected = backdrop.querySelector<HTMLInputElement>('input[name="government-kind"]:checked');
      const kind = GOVERNMENTS.find((entry) => entry.kind === selected?.value)?.kind ?? 'kingdom';
      const realmName = backdrop.querySelector<HTMLInputElement>('#government-realm-name')?.value ?? '';
      const state = normalizeGovernmentState({ kind, realmName });
      const confirm = this.onConfirm;
      this.close();
      confirm?.(state);
    });
    backdrop.querySelector<HTMLButtonElement>('[data-government-back]')?.addEventListener('click', () => {
      const back = this.onBack;
      this.close();
      back?.();
    });
    backdrop.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      event.preventDefault();
      const back = this.onBack;
      this.close();
      back?.();
    });
    document.body.appendChild(backdrop);
    this.modal = backdrop;
    this.render(normalizeGovernmentState());
  }

  render(state: GovernmentState): void {
    this.mount();
    const definition = governmentDefinition(state.kind);
    if (!this.hud) return;
    this.hud.textContent = definition.symbol + ' ' +
      localized(definition.nameFa, definition.nameEn) +
      ' · ' + (state.realmName || localized('قلمرو من', 'My Realm'));
    this.hud.title = localized(
      'نوع حکومت: ' + definition.nameFa + ' | عنوان حاکم: ' + definition.titleFa,
      'Government: ' + definition.nameEn + ' | Ruler: ' + definition.titleEn,
    );
    this.hud.style.borderColor = '#' + definition.flagColor.toString(16).padStart(6, '0');
  }

  open(
    onConfirm: (state: GovernmentState) => void,
    onBack: () => void,
    initial: GovernmentState,
  ): void {
    this.mount();
    if (!this.modal) return;
    this.onConfirm = onConfirm;
    this.onBack = onBack;
    this.modal.dir = getCurrentLocale() === 'fa' ? 'rtl' : 'ltr';
    this.modal.querySelector<HTMLElement>('[data-government-eyebrow]')!.textContent =
      localized('مرحله ۲ از ۲', 'STEP 2 OF 2');
    this.modal.querySelector<HTMLElement>('#government-title')!.textContent =
      localized('نوع حکومت خود را انتخاب کنید', 'Choose your government');
    this.modal.querySelector<HTMLElement>('[data-government-description]')!.textContent =
      localized('فقط عنوان حاکم و پرچم تغییر می‌کنند؛ قدرت و منابع تمام حکومت‌ها یکسان است.',
        'Only the ruler title and flag change; every government starts with equal power and resources.');
    this.modal.querySelector<HTMLElement>('[data-government-legend]')!.textContent =
      localized('نوع حکومت', 'Government type');
    for (const entry of GOVERNMENTS) {
      const node = this.modal.querySelector<HTMLElement>('[data-government-kind="' + entry.kind + '"]');
      if (node) node.textContent = localized(entry.nameFa + ' · ' + entry.titleFa, entry.nameEn + ' · ' + entry.titleEn);
    }
    this.modal.querySelector<HTMLElement>('.government-name-label')!.textContent =
      localized('نام قلمرو (اختیاری)', 'Realm name (optional)');
    const name = this.modal.querySelector<HTMLInputElement>('#government-realm-name');
    if (name) {
      name.value = initial.realmName;
      name.placeholder = localized('مثلاً قلعه من', 'e.g. My Castle');
    }
    const radio = this.modal.querySelector<HTMLInputElement>('input[name="government-kind"][value="' + initial.kind + '"]');
    if (radio) radio.checked = true;
    this.modal.querySelector<HTMLButtonElement>('[data-government-back]')!.textContent =
      localized('بازگشت به نقشه‌ها', 'Back to maps');
    this.modal.querySelector<HTMLButtonElement>('[data-government-confirm]')!.textContent =
      localized('شروع بازی', 'Start game');
    this.modal.hidden = false;
    radio?.focus();
  }

  close(): void {
    if (this.modal) this.modal.hidden = true;
    this.onConfirm = null;
    this.onBack = null;
  }

  get isOpen(): boolean {
    return Boolean(this.modal && !this.modal.hidden);
  }
}
