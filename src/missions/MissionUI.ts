import { t } from '../i18n/localization';
import type { MissionView, MissionViewEntry } from './MissionSystem';
import './missions.css';

export interface MissionUIOptions {
  onPinMission: (id?: string) => void;
}

export class MissionUI {
  private tracker: HTMLElement | null = null;
  private modal: HTMLElement | null = null;
  private toastHost: HTMLElement | null = null;
  private lastSignature = '';

  constructor(private readonly options: MissionUIOptions) {}

  mount(): void {
    if (typeof document === 'undefined' || this.tracker) return;

    const tracker = document.createElement('section');
    tracker.id = 'mission-tracker';
    tracker.className = 'mission-tracker';
    tracker.setAttribute('aria-label', t('Objectives'));
    tracker.innerHTML =
      '<button class="mission-tracker__header" type="button" data-mission-action="open">' +
        '<span class="mission-tracker__crest">♜</span>' +
        '<span class="mission-tracker__heading"><small>' + escapeHtml(t('CURRENT OBJECTIVES')) + '</small><strong>' + escapeHtml(t('Mission Journal')) + '</strong></span>' +
        '<span class="mission-tracker__count" data-mission-count>0 / 0</span>' +
      '</button>' +
      '<div class="mission-tracker__body" data-mission-active></div>' +
      '<button class="mission-tracker__footer" type="button" data-mission-action="open">' + escapeHtml(t('View all objectives')) + ' →</button>';

    const modal = document.createElement('div');
    modal.id = 'mission-journal';
    modal.className = 'modal-backdrop mission-journal-backdrop';
    modal.hidden = true;
    modal.innerHTML =
      '<section class="help-modal mission-journal" role="dialog" aria-modal="true" aria-labelledby="mission-journal-title">' +
        '<div class="mission-journal__hero">' +
          '<div><div class="eyebrow">' + escapeHtml(t('CASTLE ROLE · OBJECTIVES')) + '</div><h2 id="mission-journal-title">' + escapeHtml(t('Mission Journal')) + '</h2></div>' +
          '<button type="button" class="icon-button" data-mission-action="close" aria-label="' + escapeHtml(t('Close')) + '">×</button>' +
        '</div>' +
        '<p class="mission-journal__intro">' + escapeHtml(t('Choose a focus, watch progress update in real time, and unlock the next layer of challenges as your settlement grows.')) + '</p>' +
        '<div class="mission-journal__summary" data-mission-summary></div>' +
        '<div class="mission-journal__section"><div class="mission-journal__section-heading"><strong>' + escapeHtml(t('Available objectives')) + '</strong><small>' + escapeHtml(t('Pin any objective to make it your primary focus.')) + '</small></div><div class="mission-journal__grid" data-mission-available></div></div>' +
        '<div class="mission-journal__section"><div class="mission-journal__section-heading"><strong>' + escapeHtml(t('Completed milestones')) + '</strong><small>' + escapeHtml(t('A permanent record of this world’s progress.')) + '</small></div><div class="mission-journal__grid mission-journal__grid--completed" data-mission-completed></div></div>' +
        '<div class="mission-journal__section"><div class="mission-journal__section-heading"><strong>' + escapeHtml(t('Locked objectives')) + '</strong><small>' + escapeHtml(t('Complete prerequisite milestones to reveal these goals.')) + '</small></div><div class="mission-journal__grid mission-journal__grid--locked" data-mission-locked></div></div>' +
      '</section>';

    const toastHost = document.createElement('div');
    toastHost.className = 'mission-toast-host';
    toastHost.setAttribute('aria-live', 'polite');
    toastHost.setAttribute('aria-atomic', 'true');

    document.body.appendChild(tracker);
    document.body.appendChild(modal);
    document.body.appendChild(toastHost);

    this.tracker = tracker;
    this.modal = modal;
    this.toastHost = toastHost;

    const handleClick = (event: Event): void => {
      const target = event.target as HTMLElement | null;
      const actionElement = target?.closest<HTMLElement>('[data-mission-action]');
      if (!actionElement) return;
      const action = actionElement.dataset.missionAction;
      if (action === 'open') modal.hidden = false;
      if (action === 'close') modal.hidden = true;
      if (action === 'pin') {
        this.options.onPinMission(actionElement.dataset.missionId);
        modal.hidden = true;
      }
    };

    tracker.addEventListener('click', handleClick);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) modal.hidden = true;
      handleClick(event);
    });
  }

  render(view: MissionView, completedIds: readonly string[] = []): void {
    this.mount();
    if (!this.tracker || !this.modal) return;

    const signature = JSON.stringify({
      pinned: view.pinnedMissionId,
      active: view.active.map((entry) => [entry.definition.id, entry.progress.current, entry.progress.target]),
      completed: view.completed.map((entry) => [entry.definition.id, entry.completedAt]),
      locked: view.locked.map((entry) => entry.definition.id),
    });

    if (signature !== this.lastSignature) {
      this.lastSignature = signature;
      this.renderTracker(view);
      this.renderJournal(view);
    }

    for (const id of completedIds) {
      const entry = view.completed.find((candidate) => candidate.definition.id === id);
      if (entry) this.showCompletionToast(entry);
    }
  }

  private renderTracker(view: MissionView): void {
    if (!this.tracker) return;
    const count = this.tracker.querySelector<HTMLElement>('[data-mission-count]');
    const active = this.tracker.querySelector<HTMLElement>('[data-mission-active]');
    if (count) count.textContent = view.totalCompleted + ' / ' + view.totalMissions;
    if (!active) return;

    const visible = view.active.slice(0, 3);
    active.innerHTML = visible.length
      ? visible.map((entry) => this.compactCard(entry)).join('')
      : '<div class="mission-tracker__empty"><span>✦</span><strong>' + escapeHtml(t('All current objectives complete')) + '</strong><small>' + escapeHtml(t('More missions can be added without changing the mission UI.')) + '</small></div>';
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
        '<div class="mission-journal__summary-copy"><strong>' + view.totalCompleted + ' / ' + view.totalMissions + '</strong><span>' + escapeHtml(t('Milestones completed')) + '</span></div>' +
        '<div class="mission-journal__summary-progress"><span style="width:' + percent + '%"></span></div>' +
        '<b>' + percent + '%</b>';
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

  private compactCard(entry: MissionViewEntry): string {
    const ratio = progressPercent(entry);
    return '<article class="mission-compact ' + (entry.pinned ? 'is-pinned' : '') + '">' +
      '<div class="mission-compact__top"><span class="mission-compact__icon">' + escapeHtml(entry.definition.icon) + '</span><div><strong>' + escapeHtml(t(entry.definition.title)) + '</strong><small>' + escapeHtml(t(entry.definition.progressLabel)) + ' · ' + formatProgress(entry) + '</small></div></div>' +
      '<div class="mission-progress" aria-label="' + ratio + '%"><span style="width:' + ratio + '%"></span></div>' +
    '</article>';
  }

  private fullCard(entry: MissionViewEntry, completed: boolean): string {
    const ratio = completed ? 100 : progressPercent(entry);
    const pinLabel = entry.pinned ? t('Primary objective') : t('Pin objective');
    return '<article class="mission-card mission-card--' + escapeHtml(entry.definition.category) + ' ' + (entry.pinned ? 'is-pinned' : '') + ' ' + (completed ? 'is-complete' : '') + '">' +
      '<div class="mission-card__header"><span class="mission-card__icon">' + escapeHtml(entry.definition.icon) + '</span><div><small>' + escapeHtml(t(entry.definition.category.toUpperCase())) + '</small><strong>' + escapeHtml(t(entry.definition.title)) + '</strong></div>' + (completed ? '<span class="mission-card__complete-mark">✓</span>' : '') + '</div>' +
      '<p>' + escapeHtml(t(entry.definition.description)) + '</p>' +
      '<div class="mission-card__progress-copy"><span>' + escapeHtml(t(entry.definition.progressLabel)) + '</span><strong>' + formatProgress(entry) + '</strong></div>' +
      '<div class="mission-progress mission-progress--large"><span style="width:' + ratio + '%"></span></div>' +
      (completed ? '<small class="mission-card__completion">' + escapeHtml(t('Milestone completed')) + '</small>' : '<button type="button" class="secondary-button mission-card__pin" data-mission-action="pin" data-mission-id="' + escapeHtml(entry.definition.id) + '">' + escapeHtml(pinLabel) + '</button>') +
    '</article>';
  }

  private lockedCard(entry: MissionViewEntry): string {
    return '<article class="mission-card is-locked">' +
      '<div class="mission-card__header"><span class="mission-card__icon">◇</span><div><small>' + escapeHtml(t('LOCKED')) + '</small><strong>' + escapeHtml(t(entry.definition.title)) + '</strong></div></div>' +
      '<p>' + escapeHtml(t('Complete the preceding milestone to reveal full progress for this objective.')) + '</p>' +
    '</article>';
  }

  private showCompletionToast(entry: MissionViewEntry): void {
    if (!this.toastHost) return;
    const toast = document.createElement('article');
    toast.className = 'mission-toast';
    toast.innerHTML =
      '<span class="mission-toast__seal">✓</span>' +
      '<div><small>' + escapeHtml(t('OBJECTIVE COMPLETE')) + '</small><strong>' + escapeHtml(t(entry.definition.title)) + '</strong><span>' + escapeHtml(t('A new milestone has been recorded.')) + '</span></div>';
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
  return Math.round(entry.progress.current) + ' / ' + Math.round(entry.progress.target);
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
