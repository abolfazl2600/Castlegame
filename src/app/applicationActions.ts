export const OPEN_SETTINGS_EVENT = 'castlegame:open-settings';

export function requestOpenSettings(): void {
  document.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));
}
