import { getCurrentLocale } from '../i18n/localization';
import type { LandParcel } from '../systems/LandCoinSystem';
import { LAND_PARCEL_PRICE } from '../systems/LandCoinSystem';
import './LandCoinUI.css';

const localized = (fa: string, en: string): string => getCurrentLocale() === 'fa' ? fa : en;
const number = (n: number): string => n.toLocaleString(getCurrentLocale() === 'fa' ? 'fa-IR' : 'en-US');

export class LandCoinUI {
  private hud: HTMLButtonElement | null = null;
  private balanceText: HTMLElement | null = null;
  private modal: HTMLElement | null = null;
  private selected: LandParcel | null = null;
  private balance = 0;

  constructor(
    private readonly buy: (x: number, y: number) => 'purchased' | 'owned' | 'insufficient' | 'invalid',
  ) {}

  mount(): void {
    if (this.hud || typeof document === 'undefined') return;
    const hud = document.createElement('button');
    hud.id = 'land-coin-hud';
    hud.className = 'land-coin-hud';
    hud.type = 'button';
    hud.title = localized('سکه‌ها و زمین‌های قابل خرید', 'Coins and available land');
    const mark = document.createElement('span');
    mark.className = 'land-coin-hud__symbol';
    mark.textContent = '●';
    mark.setAttribute('aria-hidden', 'true');
    const balance = document.createElement('strong');
    this.balanceText = balance;
    hud.append(mark, balance);
    hud.addEventListener('click', () => {
      this.openHelp();
    });
    document.body.appendChild(hud);
    this.hud = hud;

    const backdrop = document.createElement('div');
    backdrop.id = 'land-parcel-dialog';
    backdrop.className = 'land-parcel-dialog';
    backdrop.hidden = true;
    backdrop.innerHTML = '<section role="dialog" aria-modal="true" aria-labelledby="land-parcel-heading" tabindex="-1">' +
      '<h2 id="land-parcel-heading"></h2>' +
      '<p data-land-parcel-description></p>' +
      '<p class="land-parcel-dialog__balance" data-land-parcel-balance></p>' +
      '<div class="land-parcel-dialog__buttons">' +
      '<button type="button" data-land-parcel-buy></button>' +
      '<button type="button" data-land-parcel-close></button>' +
      '</div></section>';
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop || (event.target as HTMLElement).closest('[data-land-parcel-close]')) {
        this.close();
        return;
      }
      if ((event.target as HTMLElement).closest('[data-land-parcel-buy]') && this.selected) {
        const result = this.buy(this.selected.x, this.selected.y);
        if (result === 'purchased' || result === 'owned') this.close();
        else this.refreshDialog();
      }
    });
    backdrop.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.close();
      }
    });
    document.body.appendChild(backdrop);
    this.modal = backdrop;
    this.render(0);
  }

  render(balance: number): void {
    this.balance = balance;
    if (!this.hud) return;
    if (this.balanceText) this.balanceText.textContent = number(balance);
    this.hud.setAttribute('aria-label', localized(`موجودی ${number(balance)} سکه`, `${number(balance)} coins`));
    if (!this.modal?.hidden) this.refreshDialog();
  }

  offer(parcel: LandParcel): void {
    this.mount();
    if (!this.modal) return;
    this.selected = parcel;
    this.refreshDialog();
    this.modal.hidden = false;
    this.modal.querySelector<HTMLElement>('section')?.focus();
  }

  private openHelp(): void {
    this.mount();
    if (!this.modal) return;
    this.selected = null;
    this.refreshDialog();
    this.modal.hidden = false;
    this.modal.querySelector<HTMLElement>('section')?.focus();
  }

  private refreshDialog(): void {
    if (!this.modal) return;
    const title = this.modal.querySelector<HTMLElement>('#land-parcel-heading');
    const description = this.modal.querySelector<HTMLElement>('[data-land-parcel-description]');
    const balance = this.modal.querySelector<HTMLElement>('[data-land-parcel-balance]');
    const buy = this.modal.querySelector<HTMLButtonElement>('[data-land-parcel-buy]');
    const close = this.modal.querySelector<HTMLButtonElement>('[data-land-parcel-close]');
    if (title) title.textContent = this.selected
      ? localized('گسترش قلمرو', 'Expand territory')
      : localized('سکه‌های قلمرو', 'Territory coins');
    if (description) description.textContent = this.selected
      ? localized(
        `آزادسازی این زمین (${number(this.selected.cols)}×${number(this.selected.rows)} خانه) با ${number(this.selected.cost)} سکه. پس از خرید می‌توانید در آن ساخت‌وساز کنید.`,
        `Unlock this ${number(this.selected.cols)}×${number(this.selected.rows)} plot for ${number(this.selected.cost)} coins and build there.`,
      )
      : localized(
        `با هر ۳۰ ثانیه حضور فعال در بازی، ۱ سکه می‌گیرید. برای خرید زمین، روی بخش قفل‌شده نقشه بزنید. قیمت هر قطعه ${number(LAND_PARCEL_PRICE)} سکه است.`,
        `Earn 1 coin for every 30 seconds of active gameplay. Tap locked land to buy it. Each parcel costs ${LAND_PARCEL_PRICE} coins.`,
      );
    if (balance) balance.textContent = localized(`موجودی: ${number(this.balance)} سکه`, `Balance: ${number(this.balance)} coins`);
    if (buy) {
      buy.hidden = !this.selected;
      buy.disabled = !this.selected || this.balance < this.selected.cost;
      buy.textContent = this.selected && this.balance < this.selected.cost
        ? localized('سکه کافی ندارید', 'Not enough coins')
        : localized('خرید این زمین', 'Buy this land');
    }
    if (close) close.textContent = localized('بستن', 'Close');
  }

  close(): void {
    if (!this.modal) return;
    this.modal.hidden = true;
    this.selected = null;
    this.hud?.focus();
  }
}
