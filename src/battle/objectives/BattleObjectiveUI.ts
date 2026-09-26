import type { BattleObjectiveRuntimeState, BattleObjectiveDefinition } from './BattleObjectiveTypes';

type ObjectiveItem = {
  definition: BattleObjectiveDefinition;
  runtime: BattleObjectiveRuntimeState;
};

export class BattleObjectiveUI {
  private panel: HTMLElement | null = null;
  private style: HTMLStyleElement | null = null;
  private isVisible = true;

  constructor(private readonly getState: () => ObjectiveItem[]) {}

  mount(): void {
    if (typeof document === 'undefined' || this.panel?.isConnected) return;

    const existing = document.getElementById('battle-objectives-panel');
    if (existing) {
      this.panel = existing;
      this.ensureStyles();
      return;
    }

    this.ensureStyles();

    const panel = document.createElement('section');
    panel.id = 'battle-objectives-panel';
    panel.className = 'battle-objectives-panel';
    panel.setAttribute('aria-label', 'Battle objectives');
    panel.setAttribute('aria-live', 'polite');
    document.body.appendChild(panel);

    this.panel = panel;
    panel.addEventListener('click', (event) => {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('[data-battle-objectives-close]')
        : null;
      if (!target) return;
      this.isVisible = false;
      panel.hidden = true;
    });
  }

  render(): void {
    if (!this.panel) return;

    if (!this.isVisible) {
      this.panel.hidden = true;
      return;
    }

    this.panel.hidden = false;
    const items = this.getState();
    const groups: Record<string, string> = {
      primary: 'PRIMARY',
      secondary: 'SECONDARY',
    };

    const sections = Object.entries(groups)
      .map(([priority, label]) => {
        const group = items.filter((item) => item.definition.priority === priority);
        if (group.length === 0) return '';

        const activeCount = group.filter(({ runtime }) => runtime.status === 'active').length;
        const completedCount = group.filter(({ runtime }) => runtime.status === 'completed').length;
        const statusSummary = this.getGroupSummary(group.length, activeCount, completedCount);

        return `
          <section class="battle-objectives-group" aria-label="${escapeHtml(label)} objectives">
            <header class="battle-objectives-header">
              <div class="battle-objectives-heading">
                <span class="battle-objectives-eyebrow">BATTLE</span>
                <strong>OBJECTIVES</strong>
              </div>
              <div class="battle-objectives-header-actions">
                <span class="battle-objectives-count">${statusSummary}</span>
                <button type="button" class="battle-objectives-close" data-battle-objectives-close aria-label="Close battle objectives">×</button>
              </div>
            </header>
            <div class="battle-objectives-list">
              ${group.map(({ definition, runtime }) => this.renderObjective(definition, runtime)).join('')}
            </div>
          </section>
        `;
      })
      .join('');

    this.panel.innerHTML = sections || '<div class="battle-objectives-empty">No objectives</div>';
  }

  unmount(): void {
    this.panel?.remove();
    this.panel = null;
    this.style?.remove();
    this.style = null;
  }

  private renderObjective(
    definition: BattleObjectiveDefinition,
    runtime: BattleObjectiveRuntimeState,
  ): string {
    const percent = Math.max(0, Math.min(100, Math.round(runtime.progressRatio * 100)));
    const status = this.getDisplayStatus(runtime);
    const symbol = this.getSymbol(runtime.status);
    const isCompleted = runtime.status === 'completed';
    const isLocked = runtime.status === 'locked';
    const isFailed = runtime.status === 'failed';

    return `
      <article class="battle-objective battle-objective--${runtime.status}" aria-label="${escapeHtml(definition.title)}">
        <div class="battle-objective-main">
          <div class="battle-objective-title-row">
            <span class="battle-objective-symbol" aria-hidden="true">${symbol}</span>
            <strong class="battle-objective-title">${escapeHtml(definition.title)}</strong>
          </div>
          ${definition.description ? `<p class="battle-objective-description">${escapeHtml(definition.description)}</p>` : ''}
        </div>

        <div class="battle-objective-meta">
          <span class="battle-objective-status">${status}</span>
          <strong class="battle-objective-percent">${percent}%</strong>
        </div>

        <div
          class="battle-objective-progress"
          role="progressbar"
          aria-label="${escapeHtml(definition.title)} progress"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow="${percent}"
        >
          <span class="battle-objective-progress-fill" style="width:${percent}%"></span>
        </div>
        ${isFailed ? '<span class="battle-objective-failure">Objective failed</span>' : ''}
        ${isCompleted ? '<span class="battle-objective-complete-mark" aria-hidden="true">✓</span>' : ''}
        ${isLocked ? '<span class="battle-objective-locked-mark" aria-hidden="true">LOCKED</span>' : ''}
      </article>
    `;
  }

  private getDisplayStatus(runtime: BattleObjectiveRuntimeState): string {
    if (runtime.status === 'completed') return 'COMPLETED';
    if (runtime.status === 'failed') return 'FAILED';
    if (runtime.status === 'locked') return 'LOCKED';
    return runtime.progressRatio > 0 ? 'IN PROGRESS' : 'ACTIVE';
  }

  private getSymbol(status: BattleObjectiveRuntimeState['status']): string {
    if (status === 'completed') return '✓';
    if (status === 'failed') return '✕';
    if (status === 'locked') return '○';
    return '•';
  }

  private getGroupSummary(total: number, active: number, completed: number): string {
    if (active > 0) return `${active}/${total} ACTIVE`;
    if (completed === total) return `${completed}/${total} COMPLETE`;
    return `${completed}/${total} COMPLETE`;
  }

  private ensureStyles(): void {
    if (typeof document === 'undefined' || document.getElementById('battle-objectives-styles')) return;

    const style = document.createElement('style');
    style.id = 'battle-objectives-styles';
    style.textContent = `
      .battle-objectives-panel {
        position: fixed;
        top: 88px;
        right: 18px;
        z-index: 50;
        width: min(340px, calc(100vw - 36px));
        max-width: calc(100vw - 36px);
        max-height: min(70vh, 620px);
        overflow: auto;
        padding: 10px;
        border: 1px solid rgba(255, 212, 119, .26);
        border-radius: 14px;
        background: rgba(9, 15, 21, .88);
        backdrop-filter: blur(12px);
        box-shadow: 0 14px 38px rgba(0, 0, 0, .32), inset 0 1px rgba(255,255,255,.05);
        color: #f5f7fa;
        font: 12px/1.4 system-ui, sans-serif;
        box-sizing: border-box;
        scrollbar-width: thin;
      }

      .battle-objectives-group {
        display: grid;
        gap: 7px;
      }

      .battle-objectives-group + .battle-objectives-group {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid rgba(255,255,255,.07);
      }

      .battle-objectives-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 1px 2px 3px;
      }

      .battle-objectives-heading {
        min-width: 0;
        display: flex;
        align-items: baseline;
        gap: 7px;
      }

      .battle-objectives-heading strong {
        font-size: 11px;
        line-height: 1;
        letter-spacing: .1em;
      }

      .battle-objectives-eyebrow {
        color: #ffd477;
        font-size: 7px;
        font-weight: 900;
        letter-spacing: .16em;
      }

      .battle-objectives-count {
        flex: 0 0 auto;
        color: rgba(255, 245, 215, .72);
        font-size: 9px;
        font-weight: 800;
        letter-spacing: .05em;
        white-space: nowrap;
      }

      .battle-objectives-header-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: 0 0 auto;
      }

      .battle-objectives-close {
        width: 24px;
        height: 24px;
        display: inline-grid;
        place-items: center;
        padding: 0;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 7px;
        color: rgba(255,255,255,.78);
        background: rgba(255,255,255,.045);
        cursor: pointer;
        font: 16px/1 system-ui, sans-serif;
      }

      .battle-objectives-close:hover { background: rgba(255,255,255,.1); }

      .battle-objectives-list {
        display: grid;
        gap: 6px;
      }

      .battle-objective {
        position: relative;
        min-width: 0;
        display: grid;
        gap: 5px;
        padding: 9px 10px 8px;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 11px;
        background: rgba(255,255,255,.035);
        overflow: hidden;
      }

      .battle-objective--completed {
        border-color: rgba(99, 230, 190, .18);
        background: rgba(99, 230, 190, .055);
      }

      .battle-objective--failed {
        border-color: rgba(255, 130, 120, .18);
        background: rgba(255, 100, 90, .045);
      }

      .battle-objective--locked {
        opacity: .58;
      }

      .battle-objective-main {
        min-width: 0;
      }

      .battle-objective-title-row {
        min-width: 0;
        display: flex;
        align-items: flex-start;
        gap: 7px;
      }

      .battle-objective-symbol {
        flex: 0 0 18px;
        width: 18px;
        color: #ffd477;
        font-size: 14px;
        font-weight: 900;
        line-height: 1.2;
        text-align: center;
      }

      .battle-objective--completed .battle-objective-symbol {
        color: #63e6be;
      }

      .battle-objective--failed .battle-objective-symbol {
        color: #ff8f86;
      }

      .battle-objective-title {
        min-width: 0;
        color: #f8fbfd;
        font-size: 12px;
        line-height: 1.3;
        overflow-wrap: anywhere;
      }

      .battle-objective-description {
        margin: 2px 0 0 25px;
        color: rgba(225, 235, 242, .6);
        font-size: 9px;
        line-height: 1.4;
        overflow-wrap: anywhere;
      }

      .battle-objective-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-left: 25px;
      }

      .battle-objective-status {
        min-width: 0;
        color: rgba(255, 212, 119, .68);
        font-size: 8px;
        font-weight: 850;
        letter-spacing: .08em;
      }

      .battle-objective-percent {
        flex: 0 0 auto;
        color: #f6f8fa;
        font-size: 10px;
        font-variant-numeric: tabular-nums;
      }

      .battle-objective--completed .battle-objective-status {
        color: rgba(99, 230, 190, .82);
      }

      .battle-objective--failed .battle-objective-status {
        color: rgba(255, 143, 134, .82);
      }

      .battle-objective-progress {
        height: 4px;
        margin-left: 25px;
        border-radius: 999px;
        background: rgba(255,255,255,.09);
        overflow: hidden;
      }

      .battle-objective-progress-fill {
        display: block;
        height: 100%;
        max-width: 100%;
        border-radius: inherit;
        background: #ffd477;
        transition: width .22s ease;
      }

      .battle-objective--completed .battle-objective-progress-fill {
        background: #63e6be;
      }

      .battle-objective--failed .battle-objective-progress-fill {
        background: #ff8f86;
      }

      .battle-objective-complete-mark,
      .battle-objective-locked-mark,
      .battle-objective-failure {
        position: absolute;
        top: 8px;
        right: 9px;
        font-size: 7px;
        font-weight: 900;
        letter-spacing: .08em;
      }

      .battle-objective-complete-mark { color: #63e6be; }
      .battle-objective-locked-mark { color: rgba(255,255,255,.5); }
      .battle-objective-failure { color: #ff8f86; }

      .battle-objectives-empty {
        padding: 12px;
        color: rgba(255,255,255,.5);
        text-align: center;
        font-size: 10px;
      }

      @media (max-width: 760px) {
        .battle-objectives-panel {
          top: calc(var(--mobile-header-height, 62px) + var(--mobile-safe-top, 0px) + 8px);
          left: max(8px, var(--mobile-safe-left, 0px));
          right: max(8px, var(--mobile-safe-right, 0px));
          width: auto;
          max-width: none;
          max-height: min(52dvh, 520px);
          padding: 8px;
          border-radius: 13px;
        }

        .battle-objectives-header {
          padding-inline: 2px;
        }

        .battle-objective {
          padding: 8px 9px 7px;
        }

        .battle-objective-title {
          font-size: 11px;
        }

        .battle-objective-description {
          font-size: 8px;
        }

        .battle-objective-meta {
          margin-left: 25px;
        }

        .battle-objective-progress {
          height: 4px;
          margin-left: 25px;
        }
      }

      @media (max-width: 390px) {
        .battle-objectives-panel {
          top: calc(var(--mobile-header-height, 62px) + var(--mobile-safe-top, 0px) + 6px);
          max-height: min(48dvh, 430px);
          padding: 7px;
        }

        .battle-objectives-list {
          gap: 5px;
        }

        .battle-objective {
          padding: 7px 8px 6px;
          gap: 4px;
        }

        .battle-objective-title {
          font-size: 10.5px;
        }

        .battle-objective-description {
          margin-left: 24px;
          font-size: 8px;
        }

        .battle-objective-meta,
        .battle-objective-progress {
          margin-left: 24px;
        }
      }
    `;

    document.head.appendChild(style);
    this.style = style;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char] ?? char);
}
