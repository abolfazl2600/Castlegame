import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const metricsPath = resolve(arg('--metrics', 'visual-baselines/current/metrics.json'));
const outputPath = resolve(arg('--out', resolve(dirname(metricsPath), 'summary.md')));
const report = JSON.parse(await readFile(metricsPath, 'utf8'));

const number = (value, digits = 1) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
const integer = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value).toLocaleString('en-US') : 'n/a';
const bytes = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'n/a';
  const units = ['B', 'KB', 'MB', 'GB'];
  let scaled = value;
  let unit = 0;
  while (scaled >= 1024 && unit < units.length - 1) {
    scaled /= 1024;
    unit += 1;
  }
  return `${scaled.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
};

const lines = [
  '# Castle Role visual baseline',
  '',
  `Fixed seed: **${report.seed}**  `,
  `Captured: **${report.capturedAt ?? 'unknown'}**  `,
  report.source?.gitSha ? `Commit: \`${report.source.gitSha}\`  ` : '',
  '',
  '## Environment',
  '',
  '| Item | Value |',
  '| --- | --- |',
  `| Browser | ${report.browser?.version ?? 'n/a'} |`,
  `| Host | ${report.host?.platform ?? 'n/a'} / ${report.host?.arch ?? 'n/a'} |`,
  `| Node | ${report.host?.node ?? 'n/a'} |`,
  `| CPU | ${report.host?.cpuModel ?? 'n/a'} (${report.host?.cpus ?? 'n/a'} logical) |`,
  `| Host memory | ${bytes(report.host?.totalMemoryBytes)} |`,
  `| WebGL vendor | ${report.gpu?.vendor ?? 'n/a'} |`,
  `| WebGL renderer | ${report.gpu?.renderer ?? 'n/a'} |`,
  `| WebGL version | ${report.gpu?.version ?? 'n/a'} |`,
  '',
  '## Normal desktop performance',
  '',
  '| Scene | Quality | FPS est. | Median frame | P95 frame | Draw calls | Triangles | Scene geometry | Materials | Redraw | Heap |',
  '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
];

const normalDesktop = (report.results ?? []).filter((result) =>
  result.viewport?.width === 1365 &&
  result.viewport?.height === 900 &&
  result.camera?.x === 68 &&
  result.camera?.y === 80 &&
  result.camera?.z === 76
);

for (const result of normalDesktop) {
  lines.push(
    `| ${result.scene} | ${result.quality} | ${number(result.estimatedFps)} | ${number(result.frameMedianMs, 2)} ms | ${number(result.frameP95Ms, 2)} ms | ${integer(result.drawCallsMedian)} | ${integer(result.triangles)} | ${integer(result.sceneGeometries)} | ${integer(result.sceneMaterials)} | ${number(result.redrawMs, 2)} ms | ${bytes(result.heapBytes)} |`,
  );
}

lines.push(
  '',
  '## Reference captures',
  '',
  ...(report.captures ?? []).map((capture) => `- \`${capture}\``),
  '',
  'The baseline runner uses reduced motion for repeatability, keeps shadows/effects enabled, and records low/medium/high quality measurements. CI runs use Chromium ANGLE/SwiftShader, so compare CI results with other CI results from the same runner class; do not treat software-rendered CI FPS as physical-GPU gameplay FPS.',
  '',
);

await writeFile(outputPath, lines.join('\n').replace(/\n{3,}/g, '\n\n') + '\n');
console.log(`Wrote visual baseline summary to ${outputPath}`);
