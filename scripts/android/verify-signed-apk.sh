#!/usr/bin/env bash
# Verify Android signature and owner-approved certificate before distributing an APK.
set -euo pipefail
set +x
export LC_ALL=C

if [[ $# -ne 1 || ! -s "$1" ]]; then
  echo "::error::Provide a non-empty release APK." >&2
  exit 1
fi
for name in ANDROID_KEYSTORE_PATH ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_EXPECTED_UPLOAD_SHA256; do
  if [[ -z "$(printenv "$name" 2>/dev/null || true)" ]]; then
    echo "::error::Missing verification input: $name." >&2
    exit 1
  fi
done
if [[ ! -f "$ANDROID_KEYSTORE_PATH" ]]; then
  echo "::error::Signing keystore not found." >&2
  exit 1
fi
normalize_sha256() {
  printf '%s' "$1" | tr -d '[:space:]:' | tr '[:lower:]' '[:upper:]'
}
expected="$(normalize_sha256 "$ANDROID_EXPECTED_UPLOAD_SHA256")"
if [[ ! "$expected" =~ ^[A-F0-9]{64}$ ]]; then
  echo "::error::Expected upload SHA-256 fingerprint must contain 64 hexadecimal digits." >&2
  exit 1
fi
if [[ -z "$(printenv ANDROID_HOME || true)" ]]; then
  echo "::error::ANDROID_HOME is required to locate Android apksigner." >&2
  exit 1
fi
APKSIGNER="$ANDROID_HOME/build-tools/36.0.0/apksigner"
if [[ ! -x "$APKSIGNER" ]]; then
  echo "::error::Android SDK 36 apksigner is missing." >&2
  exit 1
fi
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
if ! "$APKSIGNER" verify --verbose --print-certs --min-sdk-version 24 "$1" > "$scratch/apk-cert.txt" 2>&1; then
  echo "::error::Android APK signature verification failed." >&2
  exit 1
fi
if ! grep -Eq '^Verified using v2 scheme \(APK Signature Scheme v2\): true$' "$scratch/apk-cert.txt"; then
  echo "::error::APK Signature Scheme v2 was not verified." >&2
  exit 1
fi
signer_count="$(grep -Ec '^Signer #[0-9]+ certificate SHA-256 digest:' "$scratch/apk-cert.txt" || true)"
if [[ "$signer_count" != 1 ]]; then
  echo "::error::Expected exactly one APK signer." >&2
  exit 1
fi
apk_sha="$(sed -nE 's/^Signer #1 certificate SHA-256 digest: (.*)$/\1/p' "$scratch/apk-cert.txt" | head -n 1)"
apk_sha="$(normalize_sha256 "$apk_sha")"
if ! keytool -list -v \
  -keystore "$ANDROID_KEYSTORE_PATH" \
  -storepass:env ANDROID_KEYSTORE_PASSWORD \
  -alias "$ANDROID_KEY_ALIAS" > "$scratch/key-cert.txt" 2>/dev/null; then
  echo "::error::Could not read the expected signing certificate." >&2
  exit 1
fi
key_sha="$(awk -F 'SHA256:' '/SHA256:/{print $2; exit}' "$scratch/key-cert.txt")"
key_sha="$(normalize_sha256 "$key_sha")"
if [[ ! "$apk_sha" =~ ^[A-F0-9]{64}$ || ! "$key_sha" =~ ^[A-F0-9]{64}$ ]]; then
  echo "::error::Could not extract APK or keystore certificate SHA-256." >&2
  exit 1
fi
if [[ "$apk_sha" != "$key_sha" || "$apk_sha" != "$expected" ]]; then
  echo "::error::APK signing certificate does not match keystore and approved fingerprint." >&2
  exit 1
fi
echo "Verified APK signing certificate SHA-256: $apk_sha"
echo "Android v2 signature and trusted certificate verification passed."
