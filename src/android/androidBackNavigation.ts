import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { handleAndroidBackAction } from './androidBackAction';

/**
 * Keep Android's system Back action inside the game's existing UI hierarchy.
 * Web browsers never register this native-only listener.
 */
export function installAndroidBackNavigation(): void {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;

  void App.addListener('backButton', () => {
    handleAndroidBackAction(document, () => { void App.minimizeApp(); });
  }).catch((error: unknown) => {
    console.warn('Failed to register Android back navigation', error);
  });
}
