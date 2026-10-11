import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { MAX_ANDROID_VERSION_CODE } from './validate-release-version-code.mjs';

// The previous signed APK workflow used seconds since 2020 (~214 million in
// October 2026). Start a separate monotonic APK numbering range above that
// legacy scheme. If a marketplace has already seen a higher versionCode,
// increase ANDROID_MARKETPLACE_VERSION_CODE_BASE once before publishing.
export const DEFAULT_MARKETPLACE_VERSION_CODE_BASE = 500_000_000;
export const MARKETPLACE_RUN_ATTEMPT_SLOTS = 100;

function positiveInteger(value, label) {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) {
    throw new Error(`${label} must be a positive integer without leading zeroes.`);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error(`${label} is outside the safe integer range.`);
  return number;
}

/**
 * GitHub run_number increases on every new run of THIS workflow. run_attempt
 * increases on reruns of the same run. Reserving 100 slots per run makes codes
 * strictly increasing across all sequential runs and re-runs, provided the
 * configured base is not changed downwards.
 */
export function generateMarketplaceReleaseVersion({
  runNumber,
  runAttempt,
  base = '',
}) {
  const run = positiveInteger(runNumber, 'GITHUB_RUN_NUMBER');
  const attempt = positiveInteger(runAttempt, 'GITHUB_RUN_ATTEMPT');
  if (attempt > MARKETPLACE_RUN_ATTEMPT_SLOTS) {
    throw new Error(`More than ${MARKETPLACE_RUN_ATTEMPT_SLOTS} re-runs are not supported; start a new workflow run instead.`);
  }
  const baseline = base === '' ? DEFAULT_MARKETPLACE_VERSION_CODE_BASE : positiveInteger(base, 'ANDROID_MARKETPLACE_VERSION_CODE_BASE');
  const code = baseline + run * MARKETPLACE_RUN_ATTEMPT_SLOTS + attempt - 1;
  if (!Number.isSafeInteger(code) || code > MAX_ANDROID_VERSION_CODE) {
    throw new Error(`Generated versionCode ${code} exceeds the Android maximum (${MAX_ANDROID_VERSION_CODE}); choose an appropriate lower base.`);
  }
  const name = `1.0.${run}.${attempt}`;
  return { code, name };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { code, name } = generateMarketplaceReleaseVersion({
      runNumber: process.env.GITHUB_RUN_NUMBER,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT,
      base: process.env.ANDROID_MARKETPLACE_VERSION_CODE_BASE ?? '',
    });
    const envFile = process.env.GITHUB_ENV;
    if (!envFile) throw new Error('GITHUB_ENV is missing; this command runs inside GitHub Actions.');
    appendFileSync(envFile, `ANDROID_VERSION_CODE=${code}\nANDROID_VERSION_NAME=${name}\n`, 'utf8');
    console.log(`Automatic Bazaar / Myket APK version: ${name} (versionCode ${code})`);
    console.log('Make sure the first generated code exceeds the highest existing Bazaar and Myket release. Later codes advance automatically.');
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
