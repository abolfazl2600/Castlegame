import { APPLICATION_METADATA } from '../app/applicationMetadata';

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
  // Store-facing legal and support destinations are supplied by the centralized application metadata.
  // Application UI should consume this module rather than embedding external destinations.
  links: {
    privacyPolicy: APPLICATION_METADATA.privacyUrl,
    termsOfService: APPLICATION_METADATA.termsUrl,
    support: APPLICATION_METADATA.supportUrl,
    developerWebsite: '',
  },
  developer: {
    name: APPLICATION_METADATA.developerName,
    websiteUrl: '',
    contactUrl: APPLICATION_METADATA.supportUrl,
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
