import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const metricsPath = resolve(arg('--metrics', 'visual-baselines/final-qa/metrics.json'));
const outputPath = resolve(arg('--out', resolve(dirname(metricsPath), 'summary.md')));
const report = JSON.parse(await readFile(metricsPath, 'utf8'));

const number = (value, digits = 1) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
const integer = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value).toLocaleString('en-US') : 'n/a';

const lines = [
  '# Issue #137 — Final visual coherence QA',
  '',
  `Seed: **${report.seed}**  `,
  `Captured: **${report.capturedAt ?? 'unknown'}**  `,
  report.source?.gitSha ? `Commit: \`${report.source.gitSha}\`  ` : '',
  report.source?.runId ? `Workflow run: **${report.source.runId}**  ` : '',
  '',
  '## Scenario matrix',
  '',
  '| Capture | Scene | Battle | Viewport | P95 frame | Draw calls | Active draw cap | High detail | Detail cap | JS heap | Triangles | Materials | Redraw | UI coverage | Integration | Production target |',
  '| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |',
];

for (const result of report.results ?? []) {
  const check = (report.checks ?? []).find((entry) => entry.screenshot === result.screenshot);
  lines.push(
    `| \`${result.screenshot}\` | ${result.scene} | ${result.battle ? 'yes' : 'no'} | ${result.viewport.width}×${result.viewport.height} | ${number(result.frameP95Ms, 2)} ms | ${integer(result.drawCallsMedian)} | ${integer(result.visualBudget?.budget?.drawCalls)} | ${integer(result.visualBudget?.activeHighDetailMeshes)} | ${integer(result.visualBudget?.budget?.highDetailMeshes)} | ${result.heapBytes == null ? 'n/a' : `${number(result.heapBytes / 1024 / 1024, 0)} MiB`} | ${integer(result.triangles)} | ${integer(result.sceneMaterials)} | ${number(result.redrawMs, 2)} ms | ${number(result.uiCoverage * 100, 1)}% | ${check?.passed ? 'PASS' : 'FAIL'} | ${check?.productionBudgetPassed ? 'PASS' : 'FOLLOW-UP'} |`,
  );
}

lines.push(
  '',
  '## Reference screenshots',
  '',
  ...(report.captures ?? []).map((capture) => `- \`${capture}\``),
  '',
  '## Known focused follow-ups',
  '',
  ...(report.knownFocusedFollowups ?? []).map((issue) => `- #${issue}`),
  '',
  'The final QA does not claim those follow-up features are complete. It records them as the remaining focused work instead of reopening a broad visual rewrite.',
  '',
  '## Result',
  '',
  (report.checks ?? []).every((check) => check.passed)
    ? '**PASS — final integration checks passed, including distance-aware rendering budgets and the 2 GiB JS-heap ceiling.**'
    : '**FAIL — one or more final integration checks failed.**',
  '',
);

await writeFile(outputPath, lines.join('\n').replace(/\n{3,}/g, '\n\n') + '\n');
console.log(lines.join('\n'));
console.log(`Wrote final visual QA summary to ${outputPath}`);
