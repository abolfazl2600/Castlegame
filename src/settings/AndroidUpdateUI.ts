import { Capacitor, registerPlugin } from '@capacitor/core';

interface GameUpdaterPlugin {
  update(): Promise<{ updated: boolean; buildId?: string }>;
}

interface UpdaterError {
  code?: string;
  message?: string;
}

const GameUpdater = registerPlugin<GameUpdaterPlugin>('GameUpdater');

function updateFailureMessage(error: unknown): string {
  const failure = error && typeof error === 'object' ? error as UpdaterError : {};
  switch (failure.code) {
    case 'NETWORK':
      return 'دریافت بروزرسانی ممکن نشد. اتصال اینترنت را بررسی کنید.';
    case 'INTEGRITY':
      return 'فایل بروزرسانی معتبر نیست و نصب نشد.';
    case 'PACKAGE':
      return 'بسته بروزرسانی معتبر نیست.';
    case 'MANIFEST':
      return 'اطلاعات بروزرسانی قابل دریافت نیست. بعداً دوباره تلاش کنید.';
    case 'ACTIVATION':
      return 'بروزرسانی دریافت شد اما فعال‌سازی آن انجام نشد. نسخه فعلی حفظ شده است.';
    default:
      return 'بروزرسانی انجام نشد. بعداً دوباره تلاش کنید.';
  }
}

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
    card.innerHTML = '<span>بروزرسانی بازی</span><small>دریافت بسته وب امن از سرور عمومی بروزرسانی</small>';

    const status = document.createElement('div');
    status.className = 'settings-info-strip';
    status.setAttribute('data-game-update-status', '');
    status.innerHTML = '<span class="settings-info-dot"></span><span>برای بررسی آخرین نسخه، بروزرسانی را بزنید.</span>';

    actions.prepend(card);
    actions.insertAdjacentElement('afterend', status);

    card.addEventListener('click', async () => {
      card.disabled = true;
      const label = card.querySelector('span');
      const statusText = status.querySelector<HTMLElement>('span:last-child');
      if (label) label.textContent = 'در حال بررسی و دریافت...';
      if (statusText) statusText.textContent = 'در حال دریافت اطلاعات آخرین بروزرسانی منتشرشده...';

      try {
        const result = await GameUpdater.update();
        if (result.updated) {
          if (statusText) statusText.textContent = 'بروزرسانی تایید و فعال شد. بازی در حال بارگذاری نسخه جدید است...';
          window.setTimeout(() => window.location.reload(), 250);
          return;
        }

        if (statusText) statusText.textContent = 'بازی شما به‌روز است.';
      } catch (error) {
        console.error('Android game update failed', error);
        if (statusText) statusText.textContent = updateFailureMessage(error);
      } finally {
        if (label) label.textContent = 'بروزرسانی بازی';
        card.disabled = false;
      }
    });
  }
}
