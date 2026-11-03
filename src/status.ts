import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight } from './digest/reader.js';
import type { DigestRow, DigestStatus } from './digest/types.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type NightStatus = {
  night: string;
  counts: Record<DigestStatus, number> | null;
};

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightStatus[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

function countStatuses(rows: DigestRow[]): Record<DigestStatus, number> {
  const counts: Record<DigestStatus, number> = { ok: 0, retry: 0, fail: 0 };
  for (const row of rows) counts[row.lastStatus] += 1;
  return counts;
}

export function readNightStatus(runsDir: string, night: string): NightStatus {
  try {
    return { night, counts: countStatuses(readNight(runsDir, night)) };
  } catch {
    return { night, counts: null };
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((night) => readNightStatus(config.runsDir, night)),
  };
}
