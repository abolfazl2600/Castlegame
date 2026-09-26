import packageJson from '../../package.json';

export type StoreAssetEnvironment = 'development' | 'production';
export type StoreAssetKind = 'icon' | 'feature-graphic' | 'screenshot';
export type ScreenshotOrientation = 'landscape' | 'portrait';

export interface StoreAssetReference {
  kind: StoreAssetKind;
  path: string;
  width: number;
  height: number;
  format: 'png' | 'jpg' | 'jpeg';
  maxFileSizeKb?: number;
  locale?: string;
  orientation?: ScreenshotOrientation;
  altText: string;
}

export interface StoreScreenshotMetadata extends StoreAssetReference {
  kind: 'screenshot';
  id: string;
  device: 'phone' | 'tablet';
}

export interface StoreAssetSet {
  icon: StoreAssetReference;
  featureGraphic: StoreAssetReference;
  screenshots: readonly StoreScreenshotMetadata[];
}

export interface ApplicationMetadata {
  name: string;
  version: string;
  shortDescription: string;
  longDescription: string;
  developerName: string;
  supportUrl: string;
  privacyUrl: string;
  termsUrl: string;
  assets: Readonly<Record<StoreAssetEnvironment, StoreAssetSet>>;
}

/**
 * Store metadata is intentionally kept outside gameplay/rendering modules.
 *
 * package.json is the canonical application version source; this metadata
 * consumes it instead of duplicating the version string.
 *
 * Asset paths are logical public paths. The files themselves are intentionally
 * not committed until final, approved store artwork exists.
 */
export const APPLICATION_METADATA: ApplicationMetadata = {
  name: 'Castle Role',
  version: packageJson.version,
  shortDescription: '',
  longDescription: '',
  developerName: '',
  supportUrl: '',
  privacyUrl: '',
  termsUrl: '',
  assets: {
    development: {
      icon: {
        kind: 'icon',
        path: 'store-assets/development/icon/app-icon-512.png',
        width: 512,
        height: 512,
        format: 'png',
        maxFileSizeKb: 1024,
        altText: 'Development app icon',
      },
      featureGraphic: {
        kind: 'feature-graphic',
        path: 'store-assets/development/feature-graphic/feature-graphic-1024x500.png',
        width: 1024,
        height: 500,
        format: 'png',
        altText: 'Development feature graphic',
      },
      screenshots: [
        {
          id: 'phone-landscape-01',
          kind: 'screenshot',
          path: 'store-assets/development/screenshots/phone-landscape-01.png',
          width: 1920,
          height: 1080,
          format: 'png',
          locale: 'en-US',
          orientation: 'landscape',
          device: 'phone',
          altText: 'Development gameplay screenshot placeholder',
        },
      ],
    },
    production: {
      icon: {
        kind: 'icon',
        path: 'store-assets/production/icon/app-icon-512.png',
        width: 512,
        height: 512,
        format: 'png',
        maxFileSizeKb: 1024,
        altText: 'TODO: final production app icon alt text',
      },
      featureGraphic: {
        kind: 'feature-graphic',
        path: 'store-assets/production/feature-graphic/feature-graphic-1024x500.png',
        width: 1024,
        height: 500,
        format: 'png',
        altText: 'TODO: final production feature graphic alt text',
      },
      screenshots: [
        {
          id: 'phone-landscape-01',
          kind: 'screenshot',
          path: 'store-assets/production/screenshots/phone-landscape-01.png',
          width: 1920,
          height: 1080,
          format: 'png',
          locale: 'en-US',
          orientation: 'landscape',
          device: 'phone',
          altText: 'TODO: final production gameplay screenshot 1 alt text',
        },
        {
          id: 'phone-landscape-02',
          kind: 'screenshot',
          path: 'store-assets/production/screenshots/phone-landscape-02.png',
          width: 1920,
          height: 1080,
          format: 'png',
          locale: 'en-US',
          orientation: 'landscape',
          device: 'phone',
          altText: 'TODO: final production gameplay screenshot 2 alt text',
        },
        {
          id: 'phone-landscape-03',
          kind: 'screenshot',
          path: 'store-assets/production/screenshots/phone-landscape-03.png',
          width: 1920,
          height: 1080,
          format: 'png',
          locale: 'en-US',
          orientation: 'landscape',
          device: 'phone',
          altText: 'TODO: final production gameplay screenshot 3 alt text',
        },
        {
          id: 'phone-portrait-01',
          kind: 'screenshot',
          path: 'store-assets/production/screenshots/phone-portrait-01.png',
          width: 1080,
          height: 1920,
          format: 'png',
          locale: 'en-US',
          orientation: 'portrait',
          device: 'phone',
          altText: 'TODO: final production gameplay screenshot 4 alt text',
        },
        {
          id: 'phone-portrait-02',
          kind: 'screenshot',
          path: 'store-assets/production/screenshots/phone-portrait-02.png',
          width: 1080,
          height: 1920,
          format: 'png',
          locale: 'en-US',
          orientation: 'portrait',
          device: 'phone',
          altText: 'TODO: final production gameplay screenshot 5 alt text',
        },
        {
          id: 'phone-portrait-03',
          kind: 'screenshot',
          path: 'store-assets/production/screenshots/phone-portrait-03.png',
          width: 1080,
          height: 1920,
          format: 'png',
          locale: 'en-US',
          orientation: 'portrait',
          device: 'phone',
          altText: 'TODO: final production gameplay screenshot 6 alt text',
        },
      ],
    },
  },
};

export function getApplicationMetadata(
  environment: StoreAssetEnvironment = 'production',
): ApplicationMetadata {
  return {
    ...APPLICATION_METADATA,
    assets: {
      ...APPLICATION_METADATA.assets,
      [environment]: APPLICATION_METADATA.assets[environment],
    },
  };
}
