import { getCurrentLocale } from '../i18n/localization';
import type { MissionView } from '../missions/MissionSystem';
import { HONOR_AWARD_RULES, hasEarnedHonor } from './HonorAwards';
import {
  HonorBadgeRepository,
  type DownloadedHonorBadge,
  type HonorBadgeCatalog,
  type HonorBadgeDefinition,
} from './HonorBadgeRepository';
import './honors.css';

type Localized = { fa: string; en: string };
const language = (): 'fa' | 'en' => getCurrentLocale() === 'fa' ? 'fa' : 'en';
const translated = (fa: string, en: string): string => language() === 'fa' ? fa : en;

/**
 * Player-facing achievement display. All technical asset delivery stays hidden:
 * artwork is fetched silently from GitHub on first opening and stored in IDB.
 * Neither the remote manifest nor a successful cache operation grants an award.
 */
export class HonorGalleryUI {
  private readonly repository = new HonorBadgeRepository();
  private host: HTMLElement | null = null;
  private view: MissionView | null = null;
  private catalog: HonorBadgeCatalog | null = null;
  private readonly artwork = new Map<string, DownloadedHonorBadge>();
  private readonly imageUrls = new Map<string, string>();
  private loading = false;
  private currentSignature = '';

  mount(host: HTMLElement | null): void {
    if (!host || this.host) return;
    this.host = host;
  }

  render(view: MissionView): void {
    this.view = view;
    this.paint();
  }

  open(): void {
    if (this.loading) return;
    this.loading = true;
    void this.refresh().finally(() => {
      this.loading = false;
      this.paint();
    });
  }

  private async refresh(): Promise<void> {
    // Show cached pictures immediately, including those belonging to locked
    // missions, before contacting the network. Existing IDs remain stable.
    try {
      const saved = await this.repository.listDownloaded();
      for (const badge of saved) this.setArtwork(badge);
    } catch {
      // Cache might be disabled; progress UI is still fully usable.
    }
    this.paint();

    try {
      const result = await this.repository.loadCatalog();
      if (result.catalog) this.catalog = result.catalog;
    } catch {
      // Repository already handles cached/offline catalog fallback.
    }
    if (!this.catalog) return;

    // No buttons, network statuses, raw artwork URLs, or tech instructions in
    // the game. Limit concurrent background downloads for Android WebView.
    const items = HONOR_AWARD_RULES.filter(rule =>
      this.catalog?.badges.some(entry => entry.id === rule.id));
    for (let offset = 0; offset < items.length; offset += 2) {
      await Promise.allSettled(items.slice(offset, offset + 2).map(async rule => {
        const saved = this.artwork.get(rule.id);
        const definition = this.catalog?.badges.find(item => item.id === rule.id);
        if (saved && saved.sha256 === definition?.sha256) return;
        try {
          const result = await this.repository.download(rule.id, this.catalog!);
          this.setArtwork(result.badge);
          this.paint();
        } catch {
          // Quiet fallback: locked/unlocked placeholders remain visible.
        }
      }));
    }
  }

  private setArtwork(badge: DownloadedHonorBadge): void {
    const previous = this.artwork.get(badge.id);
    if (previous?.sha256 !== badge.sha256) {
      const url = this.imageUrls.get(badge.id);
      if (url) URL.revokeObjectURL(url);
      this.imageUrls.delete(badge.id);
    }
    this.artwork.set(badge.id, badge);
  }

  private definition(id: string): HonorBadgeDefinition | undefined {
    return this.catalog?.badges.find(item => item.id === id);
  }

  private localName(id: string, fallback: Localized): string {
    return (this.definition(id)?.name ?? this.artwork.get(id)?.name ?? fallback)[language()];
  }

  private paint(): void {
    if (!this.host || !this.view) return;
    const view = this.view;
    const earnedIds = HONOR_AWARD_RULES
      .filter(rule => hasEarnedHonor(view, rule.id)).map(rule => rule.id);
    const signature = JSON.stringify({
      locale: language(),
      completed: view.completed.map(entry => entry.definition.id),
      catalog: this.catalog?.badges.map(badge => [badge.id, badge.sha256]),
      artwork: [...this.artwork.entries()].map(([id, badge]) => [id, badge.sha256]),
    });
    if (signature === this.currentSignature) return;
    this.currentSignature = signature;
    this.host.replaceChildren();

    const heading = document.createElement('div');
    heading.className = 'honor-gallery__header';
    const title = document.createElement('h3');
    title.id = 'mission-honors-title';
    title.textContent = translated('نشان‌های افتخار', 'Honor Badges');
    heading.appendChild(title);
    const count = document.createElement('span');
    count.className = 'honor-gallery__count';
    const formatted = (value: number): string => value.toLocaleString(language() === 'fa' ? 'fa-IR' : 'en-US');
    count.textContent = translated(
      `${formatted(earnedIds.length)} از ${formatted(HONOR_AWARD_RULES.length)} آزاد شده`,
      `${formatted(earnedIds.length)} of ${formatted(HONOR_AWARD_RULES.length)} unlocked`,
    );
    heading.appendChild(count);
    this.host.appendChild(heading);

    // Put the first earned badge front and center, then show every remaining
    // badge. Until one is earned, all four appear as muted locked tiles.
    const featuredId = earnedIds[0];
    if (featuredId) {
      const rule = HONOR_AWARD_RULES.find(item => item.id === featuredId);
      if (rule) this.host.appendChild(this.badgeCard(rule, true));
    }

    const grid = document.createElement('div');
    grid.className = 'honor-gallery__grid';
    for (const rule of HONOR_AWARD_RULES) {
      if (rule.id !== featuredId) grid.appendChild(this.badgeCard(rule, false));
    }
    this.host.appendChild(grid);
  }

  private badgeCard(rule: (typeof HONOR_AWARD_RULES)[number], featured: boolean): HTMLElement {
    const view = this.view!;
    const earned = hasEarnedHonor(view, rule.id);
    const badge = this.artwork.get(rule.id);
    const remote = this.definition(rule.id);
    const name = this.localName(rule.id, rule.fallbackName);
    const card = document.createElement('article');
    card.className = 'honor-card ' + (earned ? 'is-earned' : 'is-locked') +
      (featured ? ' honor-card--featured' : '');
    card.dataset.honorId = rule.id;
    card.setAttribute('aria-label', name + ' — ' +
      (earned ? translated('آزاد شده', 'Unlocked') : translated('قفل', 'Locked')));

    const visual = document.createElement('div');
    visual.className = 'honor-card__visual';
    if (badge) {
      const img = document.createElement('img');
      img.src = this.objectUrlFor(badge);
      img.alt = '';
      img.width = 128;
      img.height = 128;
      img.decoding = 'async';
      visual.appendChild(img);
    } else {
      const silhouette = document.createElement('span');
      silhouette.className = 'honor-card__placeholder';
      silhouette.textContent = '♜';
      silhouette.setAttribute('aria-hidden', 'true');
      visual.appendChild(silhouette);
    }
    if (!earned) {
      const lock = document.createElement('span');
      lock.className = 'honor-card__lock';
      lock.setAttribute('aria-hidden', 'true');
      visual.appendChild(lock);
    }
    card.appendChild(visual);

    const body = document.createElement('div');
    body.className = 'honor-card__body';
    const title = document.createElement('h4');
    title.textContent = name;
    body.appendChild(title);
    const description = document.createElement('p');
    const mission = view.active.concat(view.completed, view.locked)
      .find(entry => entry.definition.id === rule.missionId);
    description.textContent = remote?.description[language()]
      ?? badge?.description[language()]
      ?? mission?.definition.description
      ?? translated('مأموریت مربوط به این نشان را تکمیل کنید.', 'Complete the related mission.');
    body.appendChild(description);

    const state = document.createElement('span');
    state.className = 'honor-card__status';
    state.textContent = earned ? translated('✓ آزاد شده', '✓ Unlocked') : translated('قفل', 'Locked');
    body.appendChild(state);
    card.appendChild(body);
    return card;
  }

  private objectUrlFor(badge: DownloadedHonorBadge): string {
    const cached = this.imageUrls.get(badge.id);
    if (cached) return cached;
    const url = URL.createObjectURL(badge.image);
    this.imageUrls.set(badge.id, url);
    return url;
  }

  dispose(): void {
    for (const url of this.imageUrls.values()) URL.revokeObjectURL(url);
    this.imageUrls.clear();
  }
}
