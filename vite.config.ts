import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version?: string };
const androidGradle = readFileSync(new URL('./android/app/build.gradle', import.meta.url), 'utf8');
const androidVersionCode = androidGradle.match(/\bversionCode\s+(\d+)/)?.[1] ?? 'unknown';
const androidVersionName = androidGradle.match(/\bversionName\s+"([^"]+)"/)?.[1] ?? 'unknown';
const buildSha = process.env.GITHUB_SHA ?? process.env.VITE_BUILD_SHA ?? 'local';

export default defineConfig({
  base: '/Castlegame/',
  define: {
    __BUILD_SHA__: JSON.stringify(buildSha),
    __APP_VERSION__: JSON.stringify(packageJson.version ?? 'unknown'),
    __ANDROID_VERSION_CODE__: JSON.stringify(androidVersionCode),
    __ANDROID_VERSION_NAME__: JSON.stringify(androidVersionName),
  },
});
