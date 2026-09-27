type OpenSettingsHandler = () => void;

let openSettingsHandler: OpenSettingsHandler | null = null;

export function registerOpenSettings(handler: OpenSettingsHandler): void {
  if (openSettingsHandler) {
    throw new Error('Open Settings action has already been registered');
  }
  openSettingsHandler = handler;
}

export function requestOpenSettings(): void {
  openSettingsHandler?.();
}
