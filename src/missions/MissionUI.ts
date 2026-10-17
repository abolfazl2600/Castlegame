import { getCurrentLocale, subscribeLocaleChange, t } from '../i18n/localization';
import type { MissionView, MissionViewEntry } from './MissionSystem';
import { HonorGalleryUI } from '../honors/HonorGalleryUI';
import './missions.css';

export interface MissionUIOptions {
  onPinMission: (id?: string) => void;
}

export class MissionUI {
  private modal: HTMLElement | null = null;
  private toastHost: HTMLElement | null = null;
  private lastSignature = '';
  private lastView: MissionView | null = null;
  private readonly honorGallery = new HonorGalleryUI();

  constructor(private readonly options: MissionUIOptions) {}

  mount(): void {
    if (typeof document === 'undefined' || this.modal) return;

    const trigger = document.getElementById('missions-button');
    if (!(trigger instanceof HTMLButtonElement)) return;

    const modal = document.createElement('div');
    modal.id = 'mission-journal';
    modal.className = 'modal-backdrop mission-journal-backdrop';
    modal.hidden = true;
    // Mission Journal owns its translations; the generic DOM translator must not cache translated text as source.
    modal.setAttribute('data-no-localize', '');
    modal.innerHTML =
      '<section class="help-modal mission-journal" role="dialog" aria-modal="true" aria-labelledby="mission-journal-title" tabindex="-1">' +
        '<header class="mission-journal__hero">' +
          '<div class="mission-journal__hero-copy"><div class="eyebrow" data-mission-i18n="CASTLE ROLE · OBJECTIVES">' + escapeHtml(t('CASTLE ROLE · OBJECTIVES')) + '</div><h2 id="mission-journal-title" data-mission-i18n="Mission Journal">' + escapeHtml(t('Mission Journal')) + '</h2></div>' +
          '<button type="button" class="icon-button mission-journal__close" data-mission-action="close" aria-label="' + escapeHtml(t('Close')) + '">×</button>' +
        '</header>' +
        '<div class="mission-journal__body">' +
          '<p class="mission-journal__intro" data-mission-i18n="Choose a focus, watch progress update in real time, and unlock the next layer of challenges as your settlement grows.">' + escapeHtml(t('Choose a focus, watch progress update in real time, and unlock the next layer of challenges as your settlement grows.')) + '</p>' +
          '<div class="mission-journal__summary" data-mission-summary></div>' +
          '<section class="honor-gallery" aria-labelledby="mission-honors-title" data-honor-gallery></section>' +
          '<section class="mission-journal__section" aria-labelledby="mission-available-title">' +
            '<div class="mission-journal__section-heading"><div class="mission-journal__section-copy"><h3 id="mission-available-title" data-mission-i18n="Available objectives">' + escapeHtml(t('Available objectives')) + '</h3><p data-mission-i18n="Pin any objective to make it your primary focus.">' + escapeHtml(t('Pin any objective to make it your primary focus.')) + '</p></div><span class="mission-journal__count" data-mission-count="available"></span></div>' +
            '<div class="mission-journal__grid" data-mission-available></div>' +
          '</section>' +
          '<details class="mission-journal__section mission-journal__disclosure">' +
            '<summary class="mission-journal__section-heading"><span class="mission-journal__section-copy"><span class="mission-journal__section-title" data-mission-i18n="Completed milestones">' + escapeHtml(t('Completed milestones')) + '</span><span class="mission-journal__section-description" data-mission-i18n="A permanent record of this world’s progress.">' + escapeHtml(t('A permanent record of this world’s progress.')) + '</span></span><span class="mission-journal__section-end"><span class="mission-journal__count" data-mission-count="completed"></span><span class="mission-journal__chevron" aria-hidden="true">⌄</span></span></summary>' +
            '<div class="mission-journal__grid mission-journal__grid--completed" data-mission-completed></div>' +
          '</details>' +
          '<details class="mission-journal__section mission-journal__disclosure">' +
            '<summary class="mission-journal__section-heading"><span class="mission-journal__section-copy"><span class="mission-journal__section-title" data-mission-i18n="Locked objectives">' + escapeHtml(t('Locked objectives')) + '</span><span class="mission-journal__section-description" data-mission-i18n="Complete prerequisite milestones to reveal these goals.">' + escapeHtml(t('Complete prerequisite milestones to reveal these goals.')) + '</span></span><span class="mission-journal__section-end"><span class="mission-journal__count" data-mission-count="locked"></span><span class="mission-journal__chevron" aria-hidden="true">⌄</span></span></summary>' +
            '<div class="mission-journal__grid mission-journal__grid--locked" data-mission-locked></div>' +
          '</details>' +
        '</div>' +
      '</section>';

    const toastHost = document.createElement('div');
    toastHost.className = 'mission-toast-host';
    toastHost.setAttribute('data-no-localize', '');
    toastHost.setAttribute('aria-live', 'polite');
    toastHost.setAttribute('aria-atomic', 'true');

    document.body.appendChild(modal);
    document.body.appendChild(toastHost);

    this.modal = modal;
    this.toastHost = toastHost;
    this.honorGallery.mount(modal.querySelector<HTMLElement>('[data-honor-gallery]'));
    window.addEventListener('pagehide', () => this.honorGallery.dispose(), { once: true });
    subscribeLocaleChange(() => {
      if (this.lastView) this.render(this.lastView);
    });

    let returnFocusTo: HTMLElement | null = null;
    const setOpen = (open: boolean): void => {
      if (open && modal.hidden) {
        const activeElement = document.activeElement;
        returnFocusTo = activeElement instanceof HTMLElement && activeElement !== document.body
          ? activeElement
          : trigger;
      }
      const wasOpen = !modal.hidden;
      modal.hidden = !open;
      trigger.setAttribute('aria-expanded', String(open));
      document.querySelectorAll<HTMLButtonElement>('[data-mobile-proxy="missions-button"]').forEach((proxy) => {
        proxy.setAttribute('aria-expanded', String(open));
      });
      if (open && !wasOpen) {
        this.honorGallery.open();
        modal.querySelector<HTMLButtonElement>('[data-mission-action="close"]')?.focus();
      } else if (!open && wasOpen) {
        returnFocusTo?.focus();
      }
    };

    trigger.addEventListener('click', () => setOpen(modal.hidden !== false));

    const handleClick = (event: Event): void => {
      const target = event.target as HTMLElement | null;
      const actionElement = target?.closest<HTMLElement>('[data-mission-action]');
      if (!actionElement) return;
      const action = actionElement.dataset.missionAction;
      if (action === 'open') setOpen(true);
      if (action === 'close') setOpen(false);
      if (action === 'pin') {
        this.options.onPinMission(actionElement.dataset.missionId);
        setOpen(false);
      }
    };

    modal.addEventListener('click', (event) => {
      if (event.target === modal) setOpen(false);
      handleClick(event);
    });
    modal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      // Keep keyboard navigation inside this modal; collapsed objectives have
      // no interactive descendants, and the close control is always reachable.
      const focusable = [...modal.querySelectorAll<HTMLElement>('button:not([disabled]), summary')]
        .filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  render(view: MissionView, completedIds: readonly string[] = []): void {
    this.mount();
    if (!this.modal) return;
    this.lastView = view;
    this.honorGallery.render(view);

    const signature = JSON.stringify({
      locale: getCurrentLocale(),
      pinned: view.pinnedMissionId,
      credits: view.royalCredits,
      active: view.active.map((entry) => [entry.definition.id, entry.progress.current, entry.progress.target]),
      completed: view.completed.map((entry) => [entry.definition.id, entry.completedAt]),
      locked: view.locked.map((entry) => entry.definition.id),
    });

    if (signature !== this.lastSignature) {
      this.lastSignature = signature;
      this.refreshLocaleCopy();
      this.renderJournal(view);
    }

    for (const id of completedIds) {
      const entry = view.completed.find((candidate) => candidate.definition.id === id);
      if (entry) this.showCompletionToast(entry);
    }
  }

  private refreshLocaleCopy(): void {
    for (const root of [this.modal, this.toastHost]) {
      root?.querySelectorAll<HTMLElement>('[data-mission-i18n]').forEach((element) => {
        element.textContent = t(element.dataset.missionI18n ?? '');
      });
    }
    this.modal?.querySelector<HTMLButtonElement>('[data-mission-action="close"]')
      ?.setAttribute('aria-label', t('Close'));
    this.toastHost?.querySelectorAll<HTMLElement>('[data-mission-title]').forEach((element) => {
      element.textContent = t(element.dataset.missionTitle ?? '');
    });
  }

  private renderJournal(view: MissionView): void {
    if (!this.modal) return;
    const summary = this.modal.querySelector<HTMLElement>('[data-mission-summary]');
    const available = this.modal.querySelector<HTMLElement>('[data-mission-available]');
    const completed = this.modal.querySelector<HTMLElement>('[data-mission-completed]');
    const locked = this.modal.querySelector<HTMLElement>('[data-mission-locked]');

    if (summary) {
      const percent = view.totalMissions === 0 ? 0 : Math.round((view.totalCompleted / view.totalMissions) * 100);
      summary.innerHTML =
        '<div class="mission-journal__summary-copy"><span>' + escapeHtml(t('Milestones completed')) + '</span><strong dir="ltr">' + formatMissionNumber(view.totalCompleted) + ' / ' + formatMissionNumber(view.totalMissions) + '</strong></div>' +
        '<div class="mission-journal__summary-progress" role="progressbar" aria-label="' + escapeHtml(t('Overall mission progress')) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + percent + '"><span style="width:' + percent + '%"></span></div>' +
        '<b class="mission-journal__summary-percent" dir="ltr">' + formatMissionPercent(percent) + '</b>' +
        '<div class="mission-journal__credits"><span>' + escapeHtml(t('Royal Credits earned')) + '</span><strong dir="ltr">' + formatMissionNumber(view.royalCredits) + '</strong></div>';
    }

    for (const [section, count] of [
      ['available', view.active.length],
      ['completed', view.completed.length],
      ['locked', view.locked.length],
    ] as const) {
      const element = this.modal.querySelector<HTMLElement>('[data-mission-count="' + section + '"]');
      if (element) element.textContent = formatMissionNumber(count);
    }

    if (available) {
      available.innerHTML = view.active.length
        ? view.active.map((entry) => this.fullCard(entry, false)).join('')
        : '<p class="mission-journal__empty-copy">' + escapeHtml(t('No unlocked objectives remain in the current mission set.')) + '</p>';
    }

    if (completed) {
      completed.innerHTML = view.completed.length
        ? view.completed.map((entry) => this.fullCard(entry, true)).join('')
        : '<p class="mission-journal__empty-copy">' + escapeHtml(t('Complete your first objective to begin the milestone record.')) + '</p>';
    }

    if (locked) {
      locked.innerHTML = view.locked.length
        ? view.locked.map((entry) => this.lockedCard(entry)).join('')
        : '<p class="mission-journal__empty-copy">' + escapeHtml(t('No locked objectives.')) + '</p>';
    }
  }

  private fullCard(entry: MissionViewEntry, completed: boolean): string {
    const ratio = completed ? 100 : progressPercent(entry);
    const pinLabel = entry.pinned ? t('Primary objective') : t('Pin objective');
    return '<article class="mission-card mission-card--' + escapeHtml(entry.definition.category) + ' ' + (entry.pinned ? 'is-pinned' : '') + ' ' + (completed ? 'is-complete' : '') + '">' +
      '<div class="mission-card__header"><span class="mission-card__icon" aria-hidden="true">' + escapeHtml(entry.definition.icon) + '</span><div class="mission-card__heading"><small>' + escapeHtml(t(entry.definition.category.toUpperCase())) + '</small><h4>' + escapeHtml(t(entry.definition.title)) + '</h4></div>' + (completed ? '<span class="mission-card__complete-mark" aria-label="' + escapeHtml(t('Milestone completed')) + '">✓</span>' : '') + '</div>' +
      '<p class="mission-card__description">' + escapeHtml(t(entry.definition.description)) + '</p>' +
      '<div class="mission-card__progress-copy"><span>' + escapeHtml(t(entry.definition.progressLabel)) + '</span><strong dir="ltr">' + formatProgress(entry) + '</strong></div>' +
      '<div class="mission-progress mission-progress--large" role="progressbar" aria-label="' + escapeHtml(t(entry.definition.progressLabel)) + '" aria-valuemin="0" aria-valuemax="' + entry.progress.target + '" aria-valuenow="' + Math.min(entry.progress.current, entry.progress.target) + '"><span style="width:' + ratio + '%"></span></div>' +
      '<div class="mission-card__reward">' + escapeHtml(t('Reward')) + ': <strong dir="ltr">+' + formatMissionNumber(entry.definition.rewardCredits) + '</strong> ' + escapeHtml(t('Royal Credits')) + '</div>' +
      '<div class="mission-card__footer">' + (completed ? '<span class="mission-card__completion">✓ ' + escapeHtml(t('Milestone completed')) + '</span>' : entry.pinned ? '<span class="mission-card__primary">★ ' + escapeHtml(pinLabel) + '</span>' : '<button type="button" class="secondary-button mission-card__pin" data-mission-action="pin" data-mission-id="' + escapeHtml(entry.definition.id) + '">' + escapeHtml(pinLabel) + '</button>') + '</div>' +
    '</article>';
  }

  private lockedCard(entry: MissionViewEntry): string {
    return '<article class="mission-card is-locked">' +
      '<div class="mission-card__header"><span class="mission-card__icon" aria-hidden="true">◇</span><div class="mission-card__heading"><small>' + escapeHtml(t('LOCKED')) + '</small><h4>' + escapeHtml(t(entry.definition.title)) + '</h4></div></div>' +
      '<p class="mission-card__description">' + escapeHtml(t('Complete the preceding milestone to reveal full progress for this objective.')) + '</p>' +
    '</article>';
  }

  private showCompletionToast(entry: MissionViewEntry): void {
    if (!this.toastHost) return;
    const toast = document.createElement('article');
    toast.className = 'mission-toast';
    toast.innerHTML =
      '<span class="mission-toast__seal">✓</span>' +
      '<div><small data-mission-i18n="OBJECTIVE COMPLETE">' + escapeHtml(t('OBJECTIVE COMPLETE')) + '</small><strong data-mission-title="' + escapeHtml(entry.definition.title) + '">' + escapeHtml(t(entry.definition.title)) + '</strong><span>' + escapeHtml(t('Reward')) + ': <b dir="ltr">+' + formatMissionNumber(entry.definition.rewardCredits) + '</b> ' + escapeHtml(t('Royal Credits')) + '</span></div>';
    this.toastHost.appendChild(toast);
    window.setTimeout(() => toast.classList.add('is-leaving'), 3600);
    window.setTimeout(() => toast.remove(), 4100);
  }
}

function progressPercent(entry: MissionViewEntry): number {
  if (entry.completed) return 100;
  return Math.max(0, Math.min(100, Math.round((entry.progress.current / Math.max(1, entry.progress.target)) * 100)));
}

function formatProgress(entry: MissionViewEntry): string {
  return formatMissionNumber(Math.round(entry.progress.current)) + ' / ' + formatMissionNumber(Math.round(entry.progress.target));
}

function formatMissionNumber(value: number): string {
  const source = String(value);
  if (getCurrentLocale() !== 'fa') return source;
  const digits = '۰۱۲۳۴۵۶۷۸۹';
  return source.replace(/[0-9]/g, (digit) => digits[Number(digit)]);
}

function formatMissionPercent(value: number): string {
  return formatMissionNumber(value) + (getCurrentLocale() === 'fa' ? '٪' : '%');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char] ?? char));
}
