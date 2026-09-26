# Google Play Store Assets

Castle Role keeps store metadata and asset references outside gameplay modules. The application-side registry is:

`src/app/applicationMetadata.ts`

Store artwork is separated into:

- `public/store-assets/development/` — temporary development artwork
- `public/store-assets/production/` — approved production artwork

No fake or placeholder production artwork is committed by this change.

## Metadata fields

The centralized application metadata supports:

- Application name
- Application version
- Short description
- Long description
- Developer name
- Support URL
- Privacy URL
- Terms URL
- Application icon reference
- Feature graphic reference
- Screenshot metadata, including locale, device, orientation, dimensions, format, and alt text

The application version is read from `package.json`, so the version is not duplicated in the store metadata configuration.

## Google Play requirements

The following values reflect the current Google Play Console documentation checked on 2026-09-25. Always re-check Play Console before submission because store requirements can change.

### App icon

Required for the store listing:

- 512 x 512 px
- 32-bit PNG with alpha
- Maximum 1 MB

Reference:

https://support.google.com/googleplay/android-developer/answer/9866151

### Feature graphic

Required for the store listing:

- 1024 x 500 px
- JPEG or 24-bit PNG
- No alpha channel

Reference:

https://support.google.com/googleplay/android-developer/answer/9866151

### Screenshots

Current Play Console requirements include:

- Minimum two screenshots across different device types to publish the store listing
- JPEG or 24-bit PNG
- Minimum dimension: 320 px
- Maximum dimension: 3840 px
- The maximum dimension cannot exceed twice the minimum dimension

For games, Google currently recommends at least three screenshots in either:

- Landscape: 16:9, minimum 1920 x 1080 px
- Portrait: 9:16, minimum 1080 x 1920 px

Screenshots must represent the actual in-game experience. They should not contain misleading claims, rankings, awards, pricing/promotional claims, or unrelated imagery.

Reference:

https://support.google.com/googleplay/android-developer/answer/9866151

## Store copy limits

Current Play Console product-detail limits include:

- App name: maximum 30 characters
- Short description: maximum 80 characters
- Full description: maximum 4,000 characters

The metadata configuration intentionally leaves store copy and developer/legal URLs empty until final approved content is available. This avoids inventing claims or publishing unverified contact/legal information.

Reference:

https://support.google.com/googleplay/android-developer/answer/9859152

## Asset handling rules

1. Gameplay modules must not import store artwork.
2. Store references belong only in the application metadata layer.
3. Development artwork must remain under the development asset root.
4. Production artwork must remain under the production asset root.
5. Do not commit fake screenshots, placeholder store claims, or unapproved branding as production assets.
6. Keep final production files aligned with the dimensions recorded in the metadata registry.
7. Add meaningful alt text for every final uploaded graphic.
8. Re-check Google Play policy and asset requirements before submission.

## Scope boundary

This preparation layer does not:

- change gameplay
- change Medieval or Modern/Futuristic mode behavior
- load store artwork into the game
- modify renderer behavior
- add Android packaging
- publish anything to Google Play
