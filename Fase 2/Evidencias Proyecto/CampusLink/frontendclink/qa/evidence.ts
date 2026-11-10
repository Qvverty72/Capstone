import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import type { JSONReport, JSONReportSuite } from '@playwright/test/reporter';

const report: JSONReport = JSON.parse(readFileSync('test-results/results.json', 'utf8'));
const cases: { title: string; file: string; status: string; durationMs: number; reason?: string }[] = [];
function visit(suite: JSONReportSuite) {
  for (const spec of suite.specs) for (const test of spec.tests) {
    const result = test.results.at(-1);
    cases.push({ title: spec.title, file: spec.file.replaceAll('\\', '/'), status: result?.status ?? 'not-run',
      durationMs: result?.duration ?? 0,
      ...(test.annotations.find(a => a.type === 'skip')?.description
        ? { reason: test.annotations.find(a => a.type === 'skip')!.description } : {}),
    });
  }
  suite.suites?.forEach(visit);
}
report.suites.forEach(visit);
mkdirSync('../docs/qa/results', { recursive: true });
writeFileSync('../docs/qa/results/e2e-results.json', JSON.stringify({
  startedAt: report.stats.startTime, durationMs: report.stats.duration,
  branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
  baseSHA: execFileSync('git', ['merge-base', 'HEAD', 'origin/prerelease'], { encoding: 'utf8' }).trim(),
  platform: process.platform, node: process.version, mode: report.config.projects.map(project => project.name).join(', '),
  runnerErrors: report.errors.length,
  counts: { collected: cases.length, passed: cases.filter(c => c.status === 'passed').length,
    failed: cases.filter(c => ['failed', 'timedOut', 'interrupted'].includes(c.status)).length,
    skipped: cases.filter(c => c.status === 'skipped').length }, cases,
}, null, 2) + '\n');
console.log('Sanitized E2E evidence: ../docs/qa/results/e2e-results.json');
