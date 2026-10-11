import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Google Play requires a new, unused versionCode for every uploaded bundle.
// Only the publisher can know the highest code already present in Play Console;
// GitHub Actions cannot safely infer it from the repository or commit timestamps.
export const MAX_ANDROID_VERSION_CODE = 2_100_000_000;

export function validateReleaseVersionCode(raw) {
  if (typeof raw !== 'string' || !/^[1-9][0-9]*$/.test(raw)) {
    throw new Error('Enter a positive integer version_code; find the highest previous code in Play Console and choose a larger, unused number.');
  }
  const code = Number(raw);
  if (!Number.isSafeInteger(code) || code > MAX_ANDROID_VERSION_CODE) {
    throw new Error(`version_code must be between 1 and ${MAX_ANDROID_VERSION_CODE}.`);
  }
  return code;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const code = validateReleaseVersionCode(process.argv[2]);
    const output = process.env.GITHUB_ENV;
    if (!output) throw new Error('GITHUB_ENV is missing; this command must run in GitHub Actions.');
    appendFileSync(output, `ANDROID_VERSION_CODE=${code}\n`, 'utf8');
    console.log(`Android release versionCode: ${code}`);
    console.log('Confirm this value is larger than every previously uploaded versionCode in the target store.');
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
