import type { DomainMap } from './tracker-db';
import type { TrackerCategory } from './types';

export interface RawEntry {
  owner?: { displayName?: string };
  categories?: string[];
}
export type RawDomainMap = Record<string, RawEntry>;

export interface DnrRule {
  id: number;
  priority: number;
  action: { type: 'block' };
  condition: { urlFilter: string; resourceTypes: string[] };
}

const RESOURCE_TYPES = [
  'script', 'image', 'xmlhttprequest', 'sub_frame', 'ping', 'font', 'media', 'stylesheet', 'other',
];

const CATEGORY_MAP: Record<string, TrackerCategory> = {
  advertising: 'advertising',
  analytics: 'analytics',
  'ad motivated tracking': 'advertising',
  'audience measurement': 'analytics',
  'session replay': 'session-recording',
  'social network': 'social',
  social: 'social',
  fingerprinting: 'fingerprinting',
  'third-party analytics marketing': 'analytics',
};

function normalizeCategory(categories: string[] | undefined): TrackerCategory {
  if (!categories) return 'unknown';
  for (const c of categories) {
    const hit = CATEGORY_MAP[c.toLowerCase()];
    if (hit) return hit;
  }
  return categories.length > 0 ? 'content' : 'unknown';
}

export function buildDb(
  raw: RawDomainMap,
  maxRules = 25000,
): { db: DomainMap; rules: DnrRule[] } {
  const db: DomainMap = {};
  const rules: DnrRule[] = [];
  let id = 1;
  for (const [domain, entry] of Object.entries(raw)) {
    db[domain] = {
      company: entry.owner?.displayName ?? domain,
      category: normalizeCategory(entry.categories),
    };
    if (rules.length < maxRules) {
      rules.push({
        id: id++,
        priority: 1,
        action: { type: 'block' },
        condition: { urlFilter: `||${domain}^`, resourceTypes: RESOURCE_TYPES },
      });
    }
  }
  return { db, rules };
}
