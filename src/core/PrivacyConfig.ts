export type ExternalLinkKey = 'privacyPolicy' | 'termsOfService' | 'support' | 'developerWebsite';

export type CollectionIntegrationStatus = 'not-integrated' | 'integrated';

export interface DataCollectionCapability {
  readonly id: 'analytics' | 'crashReporting';
  readonly label: string;
  readonly consentKey: 'analytics' | 'crashReporting';
  readonly integrationStatus: CollectionIntegrationStatus;
}

export interface DeveloperInformation {
  readonly name: string;
  readonly websiteUrl: string;
  readonly contactUrl: string;
}

export interface PrivacyLegalConfig {
  readonly links: Readonly<Record<ExternalLinkKey, string>>;
  readonly developer: DeveloperInformation;
  readonly dataCollection: readonly DataCollectionCapability[];
}

export const PRIVACY_LEGAL_CONFIG: PrivacyLegalConfig = {
  // Supply production URLs here when the final documents and support endpoint are ready.
  // Keep all external destinations in this module; application UI should not hardcode them.
  links: {
    privacyPolicy: '',
    termsOfService: '',
    support: '',
    developerWebsite: '',
  },
  developer: {
    name: '',
    websiteUrl: '',
    contactUrl: '',
  },
  dataCollection: [
    {
      id: 'analytics',
      label: 'Analytics',
      consentKey: 'analytics',
      integrationStatus: 'not-integrated',
    },
    {
      id: 'crashReporting',
      label: 'Crash reporting',
      consentKey: 'crashReporting',
      integrationStatus: 'not-integrated',
    },
  ],
};

export function getConfiguredExternalUrl(key: ExternalLinkKey): string | null {
  const value = PRIVACY_LEGAL_CONFIG.links[key].trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}
