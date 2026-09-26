import type { BattleObjectiveRuntimeState, BattleObjectiveDefinition } from './BattleObjectiveTypes';

export class BattleObjectiveUI {
  private panel: HTMLElement | null = null;

  constructor(private readonly getState: () => Array<{ definition: BattleObjectiveDefinition; runtime: BattleObjectiveRuntimeState }>) {}

  mount(): void {
    if (typeof document === 'undefined' || this.panel?.isConnected) return;
    const existing = document.getElementById('battle-objectives-panel');
    if (existing) {
      this.panel = existing;
      return;
    }

    const panel = document.createElement('section');
    panel.id = 'battle-objectives-panel';
    panel.setAttribute('aria-live', 'polite');
    panel.style.cssText = [
      'position:fixed','top:88px','right:18px','z-index:50','width:300px',
      'max-width:calc(100vw - 36px)','padding:14px 16px','border:1px solid rgba(255,212,119,.35)',
      'border-radius:12px','background:rgba(12,17,23,.88)','backdrop-filter:blur(8px)',
      'color:#f5f7fa','font:12px/1.4 system-ui,sans-serif','box-shadow:0 10px 30px rgba(0,0,0,.28)',
    ].join(';');
    document.body.appendChild(panel);
    this.panel = panel;
  }

  render(): void {
    if (!this.panel) return;
    const items = this.getState();
    const groups: Record<string, string> = { primary: 'PRIMARY', secondary: 'SECONDARY' };
    this.panel.innerHTML = Object.entries(groups)
      .map(([priority, label]) => {
        const group = items.filter((item) => item.definition.priority === priority);
        if (group.length === 0) return '';
        return `<div style="margin-bottom:10px"><div style="font-weight:800;letter-spacing:.08em;margin-bottom:7px">${label}</div>${group.map(({definition,runtime}) => {
          const percent = Math.round(runtime.progressRatio * 100);
          const status = runtime.status.toUpperCase();
          const symbol = runtime.status === 'completed' ? '✓' : runtime.status === 'failed' ? '✕' : runtime.status === 'locked' ? '○' : '•';
          return `<div style="margin:7px 0;opacity:${runtime.status === 'locked' ? '.58' : '1'}"><div><span style="display:inline-block;width:18px">${symbol}</span><strong>${escapeHtml(definition.title)}</strong></div><div style="margin-left:18px;color:#b9c1cc">${escapeHtml(definition.description)}</div><div style="height:5px;margin:5px 0 0 18px;background:rgba(255,255,255,.1);border-radius:99px;overflow:hidden"><div style="width:${percent}%;height:100%;background:#ffd477"></div></div><div style="margin-left:18px;color:#8f9aa8;font-size:10px">${status} · ${percent}%</div></div>`;
        }).join('')}</div>`;
      }).join('');
  }

  unmount(): void {
    this.panel?.remove();
    this.panel = null;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char] ?? char);
}
