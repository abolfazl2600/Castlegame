import { LAND_COIN_REWARD, LAND_PLOT_COUNT, LAND_PLOT_PRICE, type LandProgression } from '../world/LandProgression';
import type { WorldGridDimensions } from '../world/WorldGrid';
import './land-hud.css';

/** Non-blocking coin HUD and accessible shop for plots that remain visible in the world. */
export class LandHud {
  private readonly element: HTMLElement;
  private listSignature = '';

  constructor(
    private readonly progression: LandProgression,
    private readonly getGrid: () => WorldGridDimensions,
    private readonly onPurchase: (id: number) => void,
  ) {
    const shell = document.getElementById('game-shell');
    if (!shell) throw new Error('Game shell is missing');
    const element = document.createElement('aside');
    element.id = 'land-economy-hud';
    element.className = 'land-economy-hud';
    element.setAttribute('aria-label', 'Coins and land ownership');
    element.innerHTML = '<div class="land-coin-head"><span aria-hidden="true">🪙</span><strong id="land-coin-balance">0</strong><span id="land-coin-label"></span></div>' +
      '<small id="land-coin-countdown"></small>' +
      '<details id="land-plot-shop"><summary id="land-shop-summary"></summary><div id="land-plot-options" class="land-plot-options"></div></details>';
    element.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLButtonElement>('[data-land-buy]');
      if (!button) return;
      const id = Number(button.dataset.landBuy);
      if (!this.progression.buy(id)) return;
      this.onPurchase(id);
      this.refresh();
    });
    shell.appendChild(element);
    this.element = element;
    this.refresh();
  }

  refresh(): void {
    const fa = document.documentElement.lang === 'fa';
    const balance = this.element.querySelector('#land-coin-balance');
    const label = this.element.querySelector('#land-coin-label');
    const timer = this.element.querySelector('#land-coin-countdown');
    const summary = this.element.querySelector('#land-shop-summary');
    if (balance) balance.textContent = String(this.progression.balance);
    if (label) label.textContent = fa ? 'سکه' : 'coins';
    const countdown = Math.ceil(this.progression.millisecondsUntilReward / 1000);
    if (timer) timer.textContent = fa
      ? '+' + LAND_COIN_REWARD + ' سکه در ' + countdown + ' ثانیه بازی'
      : '+' + LAND_COIN_REWARD + ' coins in ' + countdown + 's of play';
    if (summary) summary.textContent = fa
      ? 'زمین‌های آزاد: ' + this.progression.unlockedCount + ' از ' + LAND_PLOT_COUNT
      : 'Unlocked plots: ' + this.progression.unlockedCount + '/' + LAND_PLOT_COUNT;
    const signature = [fa, this.progression.balance >= LAND_PLOT_PRICE, this.progression.snapshot().unlockedPlots.join(',')].join('|');
    if (signature === this.listSignature) return;
    this.listSignature = signature;
    const list = this.element.querySelector('#land-plot-options');
    if (!list) return;
    const plots = this.progression.plots(this.getGrid()).filter((plot) => !plot.unlocked);
    list.innerHTML = plots.map((plot) => {
      const title = (fa ? 'قطعه ' : 'Plot ') + (plot.id + 1);
      const action = fa ? 'خرید با ' + LAND_PLOT_PRICE + ' سکه' : 'Unlock · ' + LAND_PLOT_PRICE + ' coins';
      const disabled = this.progression.balance < LAND_PLOT_PRICE ? ' disabled' : '';
      return '<div class="land-plot-row" data-land-plot="' + plot.id + '"><span>' + title + '</span><button type="button" data-land-buy="' + plot.id + '"' + disabled + '>' + action + '</button></div>';
    }).join('') || (fa ? 'تمام زمین‌ها آزاد شده‌اند' : 'All plots unlocked');
  }

  promptPlot(id: number): void {
    if (this.progression.isUnlocked(id)) return;
    const shop = this.element.querySelector('#land-plot-shop');
    if (shop instanceof HTMLDetailsElement) shop.open = true;
    this.element.querySelectorAll<HTMLElement>('[data-land-plot]').forEach((row) => {
      row.classList.toggle('land-plot-target', row.dataset.landPlot === String(id));
    });
  }
}
