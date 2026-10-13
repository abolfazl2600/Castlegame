/**
 * Fallback for a failed 3D runtime import or initialization.
 * It is independent of the desktop status pill, which is hidden on mobile.
 */
export function showStartupError(): void {
  if (document.getElementById('game-startup-error')) return;

  const panel = document.createElement('section');
  panel.id = 'game-startup-error';
  panel.className = 'game-startup-error';
  panel.setAttribute('role', 'alert');
  panel.setAttribute('aria-labelledby', 'game-startup-error-title');
  panel.setAttribute('aria-describedby', 'game-startup-error-description');
  panel.innerHTML = `
    <div class="game-startup-error-card">
      <h2 id="game-startup-error-title">Game could not start</h2>
      <p id="game-startup-error-description">The 3D world could not be loaded. Try again or check WebGL support on your device.</p>
      <button type="button" data-startup-retry>Try again</button>
    </div>
  `;
  panel.querySelector<HTMLButtonElement>('[data-startup-retry]')
    ?.addEventListener('click', () => window.location.reload());

  (document.getElementById('game-shell') ?? document.body).appendChild(panel);
}
