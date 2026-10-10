/** Persistent construction work orders. World cells are reserved at placement
 * but operational consumers ignore the site until the crew finishes its work.
 * Workers deliver progress only after physically reaching the work site. */
export interface ConstructionProject {
  key: string;
  kind: string;
  x: number;
  y: number;
  workMs: number;
  requiredMs: number;
  /** Previously working level remains operational while an upgrade is built. */
  previous?: { kind: string; level: number };
}

export class ConstructionProjectSystem {
  private readonly projects = new Map<string, ConstructionProject>();

  begin(key: string, kind: string, x: number, y: number, requiredMs: number,
    previous?: { kind: string; level: number }): ConstructionProject {
    const project: ConstructionProject = {
      key, kind, x, y,
      workMs: 0,
      requiredMs: Math.max(3000, Math.min(90000, Math.round(requiredMs))),
      previous: previous ? { ...previous } : undefined,
    };
    this.projects.set(key, project);
    return { ...project, previous: project.previous ? { ...project.previous } : undefined };
  }

  has(key: string): boolean { return this.projects.has(key); }
  get(key: string): ConstructionProject | undefined {
    const project = this.projects.get(key);
    return project ? { ...project, previous: project.previous ? { ...project.previous } : undefined } : undefined;
  }
  get count(): number { return this.projects.size; }
  entries(): ConstructionProject[] { return [...this.projects.values()].map((project) => ({ ...project, previous: project.previous ? { ...project.previous } : undefined })); }

  progress(key: string): number {
    const project = this.projects.get(key);
    return project ? Math.min(1, project.workMs / project.requiredMs) : 1;
  }

  /** Returns true precisely when a work order completes, once. */
  work(key: string, deltaMs: number): boolean {
    const project = this.projects.get(key);
    if (!project || !Number.isFinite(deltaMs) || deltaMs <= 0) return false;
    project.workMs = Math.min(project.requiredMs, project.workMs + Math.min(1000, deltaMs));
    if (project.workMs < project.requiredMs) return false;
    this.projects.delete(key);
    return true;
  }

  cancel(key: string): void { this.projects.delete(key); }
  clear(): void { this.projects.clear(); }
  snapshot(): ConstructionProject[] { return this.entries(); }

  /** Legacy saves have no projects: all existing buildings remain finished. */
  restore(saved?: ConstructionProject[] | null): void {
    this.projects.clear();
    if (!Array.isArray(saved)) return;
    for (const candidate of saved.slice(0, 20000)) {
      if (!candidate || typeof candidate.key !== 'string' ||
          !/^(cell:-?\d+,-?\d+|keep:\d+|bridge:\d+)$/.test(candidate.key) ||
          typeof candidate.kind !== 'string' || candidate.kind.length > 64 ||
          !Number.isInteger(candidate.x) || !Number.isInteger(candidate.y) ||
          !Number.isFinite(candidate.requiredMs) || candidate.requiredMs < 3000 ||
          candidate.requiredMs > 90000 ||
          !Number.isFinite(candidate.workMs) || candidate.workMs < 0 ||
          candidate.workMs >= candidate.requiredMs) continue;
      this.projects.set(candidate.key, {
        key: candidate.key,
        kind: candidate.kind,
        x: candidate.x, y: candidate.y,
        workMs: candidate.workMs,
        requiredMs: candidate.requiredMs,
        previous: candidate.previous && typeof candidate.previous.kind === 'string' &&
          candidate.previous.kind.length <= 64 && Number.isInteger(candidate.previous.level) &&
          candidate.previous.level > 0 && candidate.previous.level <= 20
          ? { kind: candidate.previous.kind, level: candidate.previous.level }
          : undefined,
      });
    }
  }

  reconcile(exists: (project: ConstructionProject) => boolean): void {
    for (const [key, project] of this.projects) {
      if (!exists(project)) this.projects.delete(key);
    }
  }
}
