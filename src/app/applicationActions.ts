type OpenSettingsHandler = () => void;

export type SystemAction = 'help' | 'load' | 'save' | 'templates';
type SystemActionHandler = () => void;

let openSettingsHandler: OpenSettingsHandler | null = null;
const systemActionHandlers = new Map<SystemAction, SystemActionHandler>();

export function registerOpenSettings(handler: OpenSettingsHandler): void {
  openSettingsHandler = handler;
}

export function requestOpenSettings(): void {
  openSettingsHandler?.();
}

export function registerSystemAction(action: SystemAction, handler: SystemActionHandler): () => void {
  systemActionHandlers.set(action, handler);
  return () => {
    if (systemActionHandlers.get(action) === handler) systemActionHandlers.delete(action);
  };
}

export function requestSystemAction(action: SystemAction): boolean {
  const handler = systemActionHandlers.get(action);
  if (!handler) return false;
  handler();
  return true;
}
