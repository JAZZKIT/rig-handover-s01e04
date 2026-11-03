import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, DigestStatus } from './types.js';

type RunRecord = {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error: string | null;
};

function isDigestStatus(value: unknown): value is DigestStatus {
  return value === 'ok' || value === 'retry' || value === 'fail';
}

function parseRunRecord(line: string): RunRecord | null {
  let value: unknown;

  try {
    value = JSON.parse(line);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.at !== 'string' ||
    typeof record.job !== 'string' ||
    !isDigestStatus(record.status) ||
    (typeof record.owner !== 'string' && record.owner !== null) ||
    (record.error !== undefined && record.error !== null && typeof record.error !== 'string')
  ) {
    return null;
  }

  return {
    at: record.at,
    job: record.job,
    status: record.status,
    owner: record.owner,
    error: record.error ?? null,
  };
}

export function readNight(runsDir: string, night: string): DigestRow[] {
  const contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  const rows: DigestRow[] = [];
  const rowsByJob = new Map<string, DigestRow>();

  for (const line of contents.split(/\r?\n/)) {
    if (line.trim() === '') {
      continue;
    }

    const record = parseRunRecord(line);
    if (record === null) {
      continue;
    }

    const existing = rowsByJob.get(record.job);
    if (existing === undefined) {
      const row: DigestRow = {
        job: record.job,
        owner: record.owner,
        runs: 1,
        retries: record.status === 'retry' ? 1 : 0,
        lastStatus: record.status,
        lastError: record.error,
        firstAt: record.at,
        lastAt: record.at,
      };
      rowsByJob.set(record.job, row);
      rows.push(row);
      continue;
    }

    existing.runs += 1;
    if (record.status === 'retry') {
      existing.retries += 1;
    }
    existing.lastStatus = record.status;
    existing.lastError = record.error;
    existing.lastAt = record.at;
  }

  return rows;
}

export function sortDigestRows(rows: DigestRow[]): DigestRow[] {
  return [...rows].sort((a, b) => a.job.localeCompare(b.job));
}
