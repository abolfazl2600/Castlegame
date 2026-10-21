export type GovernmentKind = 'kingdom' | 'republic' | 'sultanate' | 'military';

export interface GovernmentState {
  version: 1;
  kind: GovernmentKind;
  realmName: string;
}

export interface GovernmentDefinition {
  kind: GovernmentKind;
  nameFa: string;
  nameEn: string;
  titleFa: string;
  titleEn: string;
  symbol: string;
  flagColor: number;
}

/** Government is cosmetic in v1: it never alters building prices, coins or combat. */
export const GOVERNMENTS: readonly GovernmentDefinition[] = [
  { kind: 'kingdom', nameFa: 'پادشاهی', nameEn: 'Kingdom', titleFa: 'پادشاه', titleEn: 'King / Queen', symbol: '♛', flagColor: 0xb4403d },
  { kind: 'republic', nameFa: 'جمهوری', nameEn: 'Republic', titleFa: 'رئیس‌جمهور', titleEn: 'President', symbol: '★', flagColor: 0x3184ac },
  { kind: 'sultanate', nameFa: 'سلطنت', nameEn: 'Sultanate', titleFa: 'سلطان', titleEn: 'Sultan', symbol: '☪', flagColor: 0x2b9679 },
  { kind: 'military', nameFa: 'حکومت نظامی', nameEn: 'Military Government', titleFa: 'فرمانده', titleEn: 'Commander', symbol: '◆', flagColor: 0x76518e },
];

export function governmentDefinition(kind: GovernmentKind): GovernmentDefinition {
  return GOVERNMENTS.find((entry) => entry.kind === kind) ?? GOVERNMENTS[0];
}

export function normalizeGovernmentState(value?: Partial<GovernmentState> | null): GovernmentState {
  const kind = GOVERNMENTS.some((entry) => entry.kind === value?.kind)
    ? value!.kind as GovernmentKind : 'kingdom';
  const realmName = typeof value?.realmName === 'string'
    ? value.realmName.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40)
    : '';
  return { version: 1, kind, realmName };
}

export class GovernmentSystem {
  private state: GovernmentState = normalizeGovernmentState();

  getState(): GovernmentState {
    return { ...this.state };
  }

  setState(value?: Partial<GovernmentState> | null): void {
    this.state = normalizeGovernmentState(value);
  }

  reset(): void {
    this.state = normalizeGovernmentState();
  }

  get definition(): GovernmentDefinition {
    return governmentDefinition(this.state.kind);
  }
}
