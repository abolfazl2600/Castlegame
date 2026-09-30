#!/usr/bin/env bash
# Verify an AAB is JAR-signed by the expected upload certificate.
set -euo pipefail
set +x
export LC_ALL=C

if [[ $# -ne 1 || ! -s "$1" ]]; then
  echo "::error::Expected a non-empty signed AAB file as the only argument." >&2
  exit 1
fi

for name in ANDROID_KEYSTORE_PATH ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_EXPECTED_UPLOAD_SHA256; do
  if [[ -z "$(printenv "$name" 2>/dev/null || true)" ]]; then
    echo "::error::Missing signing verification input: $name." >&2
    exit 1
  fi
done

if [[ ! -f "$ANDROID_KEYSTORE_PATH" ]]; then
  echo "::error::The temporary upload keystore was not found." >&2
  exit 1
fi

normalize_sha256() {
  printf '%s' "$1" | tr -d '[:space:]:' | tr '[:lower:]' '[:upper:]'
}
expected="$(normalize_sha256 "$ANDROID_EXPECTED_UPLOAD_SHA256")"
if [[ ! "$expected" =~ ^[A-F0-9]{64}$ ]]; then
  echo "::error::ANDROID_EXPECTED_UPLOAD_SHA256 must be a 64-digit hexadecimal SHA-256 certificate fingerprint." >&2
  exit 1
fi

scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT

if ! unzip -t "$1" > /dev/null 2>&1; then
  echo "::error::The AAB is not a valid ZIP archive." >&2
  exit 1
fi
if ! jarsigner -verify -verbose "$1" > "$scratch/jarsigner.log" 2>&1 ||
   ! grep -Fq 'jar verified.' "$scratch/jarsigner.log"; then
  echo "::error::AAB JAR signature verification failed." >&2
  exit 1
fi

if ! keytool -printcert -jarfile "$1" > "$scratch/bundle-certificate.txt" 2> /dev/null; then
  echo "::error::Could not read the signed AAB certificate." >&2
  exit 1
fi
if ! keytool -list -v \
    -keystore "$ANDROID_KEYSTORE_PATH" \
    -storepass:env ANDROID_KEYSTORE_PASSWORD \
    -alias "$ANDROID_KEY_ALIAS" \
    > "$scratch/keystore-certificate.txt" 2> /dev/null; then
  echo "::error::Could not read the expected upload certificate from the temporary keystore." >&2
  exit 1
fi

signed_fingerprint="$(awk -F 'SHA256:' '/SHA256:/{print $2; exit}' "$scratch/bundle-certificate.txt")"
upload_fingerprint="$(awk -F 'SHA256:' '/SHA256:/{print $2; exit}' "$scratch/keystore-certificate.txt")"
signed_fingerprint="$(normalize_sha256 "$signed_fingerprint")"
upload_fingerprint="$(normalize_sha256 "$upload_fingerprint")"

if [[ ! "$signed_fingerprint" =~ ^[A-F0-9]{64}$ || ! "$upload_fingerprint" =~ ^[A-F0-9]{64}$ ]]; then
  echo "::error::Could not extract SHA-256 upload-certificate fingerprints." >&2
  exit 1
fi
if [[ "$signed_fingerprint" != "$upload_fingerprint" || "$signed_fingerprint" != "$expected" ]]; then
  echo "::error::Signed AAB certificate, upload keystore certificate, and expected fingerprint do not match." >&2
  exit 1
fi

# SHA-256 fingerprint is public certificate metadata, not private signing material.
echo "Verified upload certificate SHA-256: $signed_fingerprint"
echo "Signed AAB is verified against the owner-approved upload certificate."
