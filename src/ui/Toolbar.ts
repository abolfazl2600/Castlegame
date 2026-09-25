import type { ToolKind } from '../core/types';

interface ToolDefinition {
  id: ToolKind;
  label: string;
  shortcut: string;
  icon: string;
  description: string;
}

const TOOLS: ToolDefinition[] = [
  { id: 'wall', label: 'Wall', shortcut: '1', icon: '▥', description: 'Build connected castle walls' },
  { id: 'gate', label: 'Gate', shortcut: '2', icon: '⌂', description: 'Add a castle gate in the wall line' },
  { id: 'tower', label: 'Tower', shortcut: '3', icon: '◉', description: 'Place a defensive watch tower' },
  { id: 'road', label: 'Road', shortcut: '4', icon: '═', description: 'Draw roads across the island' },
  { id: 'cottage', label: 'Cottage', shortcut: '5', icon: '⌁', description: 'Small settler cottage' },
  { id: 'house', label: 'House', shortcut: '6', icon: '⌘', description: 'Standard family home' },
  { id: 'manor', label: 'Manor', shortcut: '7', icon: '◫', description: 'Large noble residence' },
  { id: 'erase', label: 'Remove', shortcut: '8', icon: '⌫', description: 'Remove placed structures' },
];

export class Toolbar {
  private selected: ToolKind = 'wall';
  private readonly buttons = new Map<ToolKind, HTMLButtonElement>();

  constructor(
    root: HTMLElement,
    private readonly onSelect: (tool: ToolKind) => void,
  ) {
    const title = document.createElement('div');
    title.className = 'toolbar-title';
    title.innerHTML = '<span>Build</span><small>Compact island stronghold</small>';
    root.append(title);

    for (const tool of TOOLS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tool-button';
      button.title = `${tool.description} (${tool.shortcut})`;
      button.innerHTML = `
        <span class="tool-icon">${tool.icon}</span>
        <span class="tool-copy"><strong>${tool.label}</strong><small>${tool.description}</small></span>
        <kbd>${tool.shortcut}</kbd>
      `;
      button.addEventListener('click', () => this.select(tool.id));
      root.append(button);
      this.buttons.set(tool.id, button);
    }

    this.render();
  }

  select(tool: ToolKind): void {
    if (this.selected === tool) return;
    this.selected = tool;
    this.render();
    this.onSelect(tool);
  }

  getSelected(): ToolKind {
    return this.selected;
  }

  private render(): void {
    for (const [id, button] of this.buttons) button.classList.toggle('is-selected', id === this.selected);
  }
}
