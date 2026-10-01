import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * Keep Android's system Back action inside the game's existing UI hierarchy.
 * Web browsers never register this native-only listener.
 */
export function installAndroidBackNavigation(): void {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;

  void App.addListener('backButton', () => {
    const visible = (id: string): boolean => {
      const element = document.getElementById(id);
      return !!element && !element.hidden && getComputedStyle(element).display !== 'none';
    };
    const click = (id: string): void => {
      document.getElementById(id)?.click();
    };

    // Highest-priority app dialogs: always use their existing close/previous handlers.
    if (visible('settings-modal')) {
      click('settings-close');
      return;
    }
    if (visible('map-layout-modal')) {
      // Map layout is the only required new-game choice; keep it open until selected.
      return;
    }
    if (visible('templates-modal')) {
      click('templates-close-button');
      return;
    }
    if (visible('help-modal')) {
      click('help-close-button');
      return;
    }
    if (visible('god-mode-panel')) {
      click('god-mode-close');
      return;
    }
    if (visible('battle-panel')) {
      click('battle-close');
      return;
    }

    // Do not minimize an app while any other dialog is active.
    if (Array.from(document.querySelectorAll<HTMLElement>('dialog[open], [role="dialog"]'))
      .some((dialog) => dialog.getClientRects().length > 0)) return;

    const toolbar = document.getElementById('toolbar');
    if (toolbar && !toolbar.classList.contains('is-collapsed')) {
      document.getElementById('toolbar-close')?.click();
      return;
    }

    // Escape cancels a selected game tool before Android backgrounds the activity.
    const selectedTool = document.querySelector('[data-tool].is-selected');
    if (selectedTool) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return;
    }

    // A second Back from idle backgrounds rather than unexpectedly terminating the game.
    void App.minimizeApp();
  }).catch((error: unknown) => {
    console.warn('Failed to register Android back navigation', error);
  });
}
