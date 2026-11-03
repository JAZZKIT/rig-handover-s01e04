import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';
import type { DigestRow } from '../src/digest/types.js';

const baseConfig: Omit<RigConfig, 'runsDir'> = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
};

let runsDir: string | undefined;

beforeEach(async () => {
  runsDir = await mkdtemp(join(process.cwd(), 'test/.runs-'));
});

afterEach(async () => {
  if (runsDir !== undefined) {
    await rm(runsDir, { recursive: true, force: true });
    runsDir = undefined;
  }
});

async function writeNight(night: string, contents: string): Promise<void> {
  if (runsDir === undefined) throw new Error('runs directory is not initialized');
  await writeFile(join(runsDir, `${night}.jsonl`), contents);
}

function createTestApp() {
  if (runsDir === undefined) throw new Error('runs directory is not initialized');
  return createApp({ ...baseConfig, runsDir });
}

function jobsFromPage(html: string): string[] {
  const table = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
  return [...table.matchAll(/<tr>\s*<td>([^<]*)<\/td>/g)].map((match) => match[1]);
}

function runRecord(job: string, at: string) {
  return JSON.stringify({ at, job, status: 'ok', owner: 'lane-07' });
}

describe('digest routes', () => {
  it('returns a valid night from both routes', async () => {
    await writeNight(
      '2026-11-01',
      [runRecord('digest/render', '2026-11-01T05:00:00+01:00'), runRecord('lane/sync', '2026-11-01T05:01:00+01:00')].join(
        '\n',
      ),
    );
    const app = createTestApp();

    const page = await app.request('/digest/2026-11-01');
    const api = await app.request('/api/digest/2026-11-01');
    const html = await page.text();
    const rows = (await api.json()) as DigestRow[];

    expect(page.status).toBe(200);
    expect(api.status).toBe(200);
    expect(jobsFromPage(html)).toEqual(rows.map((row) => row.job));
    expect(rows.map((row) => row.job)).toEqual(['digest/render', 'lane/sync']);
  });

  it('returns 404 for a night with no file', async () => {
    const app = createTestApp();

    const page = await app.request('/digest/2026-11-01');
    const api = await app.request('/api/digest/2026-11-01');

    expect(page.status).toBe(404);
    expect(api.status).toBe(404);
  });

  it('renders and returns an empty night', async () => {
    await writeNight('2026-11-01', '');
    const app = createTestApp();

    const page = await app.request('/digest/2026-11-01');
    const api = await app.request('/api/digest/2026-11-01');

    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    expect(api.status).toBe(200);
    expect(await api.json()).toEqual([]);
  });

  it('ignores one malformed line while keeping valid rows in the same order', async () => {
    await writeNight(
      '2026-11-01',
      [
        runRecord('zeta/job', '2026-11-01T05:00:00+01:00'),
        '{not json}',
        runRecord('alpha/job', '2026-11-01T05:01:00+01:00'),
      ].join('\n'),
    );
    const app = createTestApp();

    const page = await app.request('/digest/2026-11-01');
    const api = await app.request('/api/digest/2026-11-01');
    const html = await page.text();
    const rows = (await api.json()) as DigestRow[];

    expect(page.status).toBe(200);
    expect(api.status).toBe(200);
    expect(jobsFromPage(html)).toEqual(['alpha/job', 'zeta/job']);
    expect(rows.map((row) => row.job)).toEqual(['alpha/job', 'zeta/job']);
    expect(jobsFromPage(html)).toEqual(rows.map((row) => row.job));
  });
});
