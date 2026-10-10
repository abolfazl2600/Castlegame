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
