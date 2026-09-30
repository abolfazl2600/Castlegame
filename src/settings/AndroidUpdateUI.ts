import { Capacitor, registerPlugin } from '@capacitor/core';

interface GameUpdaterPlugin {
  update(): Promise<{ updated: boolean; buildId?: string }>;
}

const GameUpdater = registerPlugin<GameUpdaterPlugin>('GameUpdater');

export class AndroidUpdateUI {
  constructor() {
    if (Capacitor.getPlatform() !== 'android') return;

    const pane = document.querySelector<HTMLElement>('[data-settings-pane="data"]');
    if (!pane || pane.querySelector('[data-action="update-game"]')) return;

    const actions = pane.querySelector<HTMLElement>('.settings-data-actions');
    if (!actions) return;

    const card = document.createElement('button');
    card.type = 'button';
    card.dataset.action = 'update-game';
    card.innerHTML = '<span>بروزرسانی بازی</span><small>دریافت آخرین داده‌های بازی از مخزن GitHub</small>';

    const status = document.createElement('div');
    status.className = 'settings-info-strip';
    status.setAttribute('data-game-update-status', '');
    status.innerHTML = '<span class="settings-info-dot"></span><span>برای بررسی آخرین نسخه، بروزرسانی را بزنید.</span>';

    actions.prepend(card);
    actions.insertAdjacentElement('afterend', status);

    card.addEventListener('click', async () => {
      card.disabled = true;
      const label = card.querySelector('span');
      if (label) label.textContent = 'در حال بررسی و دریافت...';
      status.querySelector('span:last-child')!.textContent = 'در حال بررسی آخرین build منتشرشده در GitHub...';

      try {
        const result = await GameUpdater.update();
        if (result.updated) {
          status.querySelector('span:last-child')!.textContent = 'بروزرسانی دریافت شد. بازی در حال بارگذاری نسخه جدید است...';
          return;
        }

        status.querySelector('span:last-child')!.textContent = 'بازی شما به‌روز است.';
        card.disabled = false;
        if (label) label.textContent = 'بروزرسانی بازی';
      } catch (error) {
        console.error('Android game update failed', error);
        status.querySelector('span:last-child')!.textContent = 'بروزرسانی ناموفق بود. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.';
        card.disabled = false;
        if (label) label.textContent = 'بروزرسانی بازی';
      }
    });
  }
}
