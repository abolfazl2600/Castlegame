/** Snapshot history for authored world edits. No renderer or browser dependency. */
export class WorldEditHistory<Snapshot> {
  private readonly undoStack: Snapshot[] = [];
  private readonly redoStack: Snapshot[] = [];
  private readonly capture: () => Snapshot;
  private readonly restore: (snapshot: Snapshot) => void;
  private readonly onRestored: () => void;
  private readonly limit: number;

  constructor(
    capture: () => Snapshot,
    restore: (snapshot: Snapshot) => void,
    onRestored: () => void,
    limit = 60,
  ) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error('History limit must be positive');
    this.capture = capture;
    this.restore = restore;
    this.onRestored = onRestored;
    this.limit = limit;
  }

  recordCurrent(): void {
    this.record(this.capture());
  }

  record(snapshot: Snapshot): void {
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  /** One validated edit becomes one undo step. A rejected edit rolls back. */
  transact(edit: () => boolean, onCommitted: () => void): boolean {
    const before = this.capture();
    let changed: boolean;
    try {
      changed = edit();
    } catch (error) {
      this.restore(before);
      throw error;
    }
    if (!changed) {
      this.restore(before);
      return false;
    }
    this.record(before);
    onCommitted();
    return true;
  }

  undo(): boolean {
    if (this.undoStack.length === 0) return false;
    const previous = this.undoStack[this.undoStack.length - 1];
    const current = this.capture();
    this.restore(previous);
    this.undoStack.pop();
    this.redoStack.push(current);
    this.onRestored();
    return true;
  }

  redo(): boolean {
    if (this.redoStack.length === 0) return false;
    const next = this.redoStack[this.redoStack.length - 1];
    const current = this.capture();
    this.restore(next);
    this.redoStack.pop();
    this.undoStack.push(current);
    this.onRestored();
    return true;
  }
}
