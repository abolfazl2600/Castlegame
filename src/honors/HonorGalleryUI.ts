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
 * Gallery is embedded in Mission Journal and only uses validated local Blobs
 * for image src. Opening it may fetch the remote *manifest*, not badge images.
 * Downloads are explicitly requested after the corresponding mission is won.
 */
export class HonorGalleryUI {
  private readonly repository = new HonorBadgeRepository();
  private host: HTMLElement | null = null;
  private view: MissionView | null = null;
  private catalog: HonorBadgeCatalog | null = null;
  private source: 'network' | 'cached' | 'unavailable' = 'unavailable';
  private readonly downloaded = new Map<string, DownloadedHonorBadge>();
  private readonly imageUrls = new Map<string, string>();
  private readonly busy = new Set<string>();
  private errors = new Map<string, string>();
  private loading = false;
  private currentSignature = '';

  mount(host: HTMLElement | null): void {
    if (!host || this.host) return;
    this.host = host;
    host.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('button[data-honor-download]');
      if (!button || !button.dataset.honorDownload) return;
      void this.download(button.dataset.honorDownload);
    });
  }

  render(view: MissionView): void {
    this.view = view;
    this.paint();
  }

  open(): void {
    if (this.loading) return;
    this.loading = true;
    void this.refresh();
  }

  private async refresh(): Promise<void> {
    // Show verified local artworks before waiting for a possibly-offline request.
    try {
      const badges = await this.repository.listDownloaded();
      for (const badge of badges) this.downloaded.set(badge.id, badge);
    } catch {
      // The service reports storage failures when the player presses Download.
    }
    this.paint();
    try {
      const response = await this.repository.loadCatalog();
      this.catalog = response.catalog;
      this.source = response.source;
    } finally {
      this.loading = false;
      this.paint();
    }
  }

  private definition(id: string): HonorBadgeDefinition | undefined {
    return this.catalog?.badges.find((item) => item.id === id);
  }

  private localName(id: string, fallback: Localized): string {
    return (this.definition(id)?.name ?? this.downloaded.get(id)?.name ?? fallback)[language()];
  }

  private paint(): void {
    if (!this.host || !this.view) return;
    const view = this.view;
    const signature = JSON.stringify({
      locale: language(),
      catalog: this.catalog?.badges.map((b) => [b.id, b.sha256]),
      source: this.source,
      completed: view.completed.map((entry) => entry.definition.id),
      downloaded: [...this.downloaded.entries()].map(([id, b]) => [id, b.sha256]),
      busy: [...this.busy],
      errors: [...this.errors],
      loading: this.loading,
    });
    if (signature === this.currentSignature) return;
    this.currentSignature = signature;
    this.host.replaceChildren();

    const title = document.createElement('h3');
    title.id = 'mission-honors-title';
    title.textContent = translated('نشان‌های افتخار', 'Honor Badges');
    this.host.appendChild(title);

    const info = document.createElement('p');
    info.className = 'honor-gallery__info';
    info.textContent = translated(
      'با تکمیل مأموریت، نشان آزاد می‌شود. تصویر آن فقط با دانلود از GitHub دریافت می‌شود و پس از آن آفلاین هم قابل مشاهده است.',
      'Complete the mission to earn a badge. Download its artwork from GitHub once, then view it offline.',
    );
    this.host.appendChild(info);

    const grid = document.createElement('div');
    grid.className = 'honor-gallery__grid';
    this.host.appendChild(grid);

    for (const rule of HONOR_AWARD_RULES) {
      const earned = hasEarnedHonor(view, rule.id);
      const saved = this.downloaded.get(rule.id);
      const remote = this.definition(rule.id);
      const name = this.localName(rule.id, rule.fallbackName);

      const card = document.createElement('article');
      card.className = 'honor-card' + (earned ? ' is-earned' : ' is-locked');
      card.dataset.honorId = rule.id;
      const visual = document.createElement('div');
      visual.className = 'honor-card__visual';

      if (saved) {
        const src = this.objectUrlFor(saved);
        const image = document.createElement('img');
        image.alt = name;
        image.src = src;
        image.width = 128;
        image.height = 128;
        image.decoding = 'async';
        visual.appendChild(image);
      } else {
        const placeholder = document.createElement('span');
        placeholder.className = 'honor-card__placeholder';
        placeholder.textContent = earned ? '↓' : '◇';
        placeholder.setAttribute('aria-hidden', 'true');
        visual.appendChild(placeholder);
      }
      card.appendChild(visual);

      const body = document.createElement('div');
      body.className = 'honor-card__body';
      const heading = document.createElement('h4');
      heading.textContent = name;
      body.appendChild(heading);

      const description = document.createElement('p');
      const mission = view.active.concat(view.completed, view.locked)
        .find((entry) => entry.definition.id === rule.missionId);
      description.textContent = remote
        ? remote.description[language()]
        : mission?.definition.description ?? translated('برای آزادسازی این نشان، مأموریت مرتبط را کامل کنید.', 'Complete its mission to unlock.');
      body.appendChild(description);

      const status = document.createElement('span');
      status.className = 'honor-card__status';
      status.textContent = saved
        ? translated('تصویر ذخیره‌شده · قابل مشاهده آفلاین', 'Downloaded · available offline')
        : earned
          ? translated('نشان دریافت شد · تصویر هنوز دانلود نشده', 'Earned · artwork not downloaded')
          : translated('قفل · مأموریت هنوز تکمیل نشده', 'Locked · complete the mission');
      body.appendChild(status);

      if (earned && !saved) {
        const button = document.createElement('button');
        button.className = 'secondary-button honor-card__download';
        button.type = 'button';
        button.dataset.honorDownload = rule.id;
        button.disabled = this.busy.has(rule.id);
        button.textContent = this.busy.has(rule.id)
          ? translated('در حال دانلود…', 'Downloading…')
          : translated('دانلود نشان', 'Download artwork');
        body.appendChild(button);
      }

      const error = this.errors.get(rule.id);
      if (error) {
        const message = document.createElement('p');
        message.className = 'honor-card__error';
        message.setAttribute('role', 'alert');
        message.textContent = error;
        body.appendChild(message);
      }
      card.appendChild(body);
      grid.appendChild(card);
    }

    const note = document.createElement('p');
    note.className = 'honor-gallery__footnote';
    note.textContent = this.source === 'unavailable'
      ? translated('برای اولین دانلود، اینترنت لازم است. فایل‌های ذخیره‌شده همچنان در دسترس‌اند.',
        'Internet is required for the first download. Saved badges remain available.')
      : translated('تصاویر جزو فایل نصب بازی نیستند و فقط هنگام دانلود دریافت می‌شوند.',
        'Badge artwork is not bundled with the game and is downloaded on request.');
    this.host.appendChild(note);
  }

  private objectUrlFor(badge: DownloadedHonorBadge): string {
    const current = this.imageUrls.get(badge.id);
    if (current) return current;
    const url = URL.createObjectURL(badge.image);
    this.imageUrls.set(badge.id, url);
    return url;
  }

  private async download(id: string): Promise<void> {
    if (!this.view || !hasEarnedHonor(this.view, id) || this.busy.has(id)) return;
    this.busy.add(id);
    this.errors.delete(id);
    this.paint();
    try {
      const result = await this.repository.download(id);
      this.downloaded.set(id, result.badge);
      const previous = this.imageUrls.get(id);
      if (previous) {
        URL.revokeObjectURL(previous);
        this.imageUrls.delete(id);
      }
    } catch {
      this.errors.set(id, translated('دریافت ناموفق بود؛ اینترنت را بررسی و دوباره تلاش کنید.',
        'Download failed. Check your connection and try again.'));
    } finally {
      this.busy.delete(id);
      this.paint();
    }
  }

  dispose(): void {
    for (const url of this.imageUrls.values()) URL.revokeObjectURL(url);
    this.imageUrls.clear();
  }
}
