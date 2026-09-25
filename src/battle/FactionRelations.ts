import type { Faction } from './types';

export class FactionRelations {
  private readonly hostilePairs = new Set<string>();

  constructor() {
    this.setHostile('attacker', 'defender', true);
  }

  setHostile(a: Faction, b: Faction, hostile: boolean): void {
    if (a === b) return;

    const keys = [this.key(a, b), this.key(b, a)];
    for (const key of keys) {
      if (hostile) this.hostilePairs.add(key);
      else this.hostilePairs.delete(key);
    }
  }

  areHostile(a: Faction, b: Faction): boolean {
    if (a === b) return false;
    return this.hostilePairs.has(this.key(a, b));
  }

  private key(a: Faction, b: Faction): string {
    return `${a}::${b}`;
  }
}
