export type ConsentState = 'unknown' | 'granted' | 'denied';

export interface PrivacyConsentState {
  readonly analytics: ConsentState;
  readonly crashReporting: ConsentState;
}

const STORAGE_KEY = 'castle-role:privacy-consent:v1';

const DEFAULT_STATE: PrivacyConsentState = {
  analytics: 'unknown',
  crashReporting: 'unknown',
};

function isConsentState(value: unknown): value is ConsentState {
  return value === 'unknown' || value === 'granted' || value === 'denied';
}

function parseState(value: string | null): PrivacyConsentState {
  if (!value) return DEFAULT_STATE;

  try {
    const parsed = JSON.parse(value) as Partial<PrivacyConsentState>;
    return {
      analytics: isConsentState(parsed.analytics) ? parsed.analytics : DEFAULT_STATE.analytics,
      crashReporting: isConsentState(parsed.crashReporting)
        ? parsed.crashReporting
        : DEFAULT_STATE.crashReporting,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export class PrivacyConsentStore {
  get(): PrivacyConsentState {
    try {
      return parseState(globalThis.localStorage.getItem(STORAGE_KEY));
    } catch {
      return DEFAULT_STATE;
    }
  }

  setAnalytics(value: ConsentState): PrivacyConsentState {
    return this.persist({
      ...this.get(),
      analytics: value,
    });
  }

  setCrashReporting(value: ConsentState): PrivacyConsentState {
    return this.persist({
      ...this.get(),
      crashReporting: value,
    });
  }

  reset(): PrivacyConsentState {
    return this.persist(DEFAULT_STATE);
  }

  private persist(state: PrivacyConsentState): PrivacyConsentState {
    try {
      globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Privacy preferences remain available for the current session even if storage is unavailable.
    }
    return state;
  }
}
