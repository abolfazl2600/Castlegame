/**
 * Route a native Android Back press through the existing UI dismissal actions.
 * This handler is kept separate from the Capacitor registration so priority
 * and cancellation can be regression-tested without native Android hardware.
 */
export function handleAndroidBackAction(doc: Document, minimizeApp: () => void): void {
  const visible = (id: string): boolean => {
    const element = doc.getElementById(id);
    return !!element && !element.hidden && getComputedStyle(element).display !== 'none';
  };
  const click = (id: string): void => {
    doc.getElementById(id)?.click();
  };

  // Preserve the existing modal priority (including the mandatory map choice).
  if (visible('settings-modal')) {
    click('settings-close');
    return;
  }
  if (visible('map-layout-modal')) {
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

  // Save/Load is a dynamically created dialog, so it has no fixed ID.
  // Trigger its existing delegated close action instead of mutating hidden.
  const saveLoadBackdrop = doc.querySelector<HTMLElement>('.save-load-backdrop');
  if (saveLoadBackdrop && !saveLoadBackdrop.hidden && getComputedStyle(saveLoadBackdrop).display !== 'none') {
    saveLoadBackdrop.querySelector<HTMLButtonElement>('[data-save-action="close"]')?.click();
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
  if (visible('mission-journal')) {
    // Use the journal's delegated close button: it also resets aria-expanded
    // for desktop and mobile triggers, unlike setting hidden directly.
    doc.querySelector<HTMLButtonElement>('#mission-journal [data-mission-action="close"]')?.click();
    return;
  }

  // Unknown visible dialogs must prevent accidental tool use/minimization.
  if (Array.from(doc.querySelectorAll<HTMLElement>('dialog[open], [role="dialog"]'))
    .some((dialog) => dialog.getClientRects().length > 0)) return;

  const toolbar = doc.getElementById('toolbar');
  if (toolbar && !toolbar.classList.contains('is-collapsed')) {
    click('toolbar-close');
    return;
  }

  const selectedTool = doc.querySelector('[data-tool].is-selected');
  if (selectedTool) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return;
  }

  minimizeApp();
}
