# Voyeur — P0 Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Voyeur detection engine — a WXT/TypeScript MV3 extension that observes every network request, classifies it against the DuckDuckGo Tracker Radar dataset (domain → company/category), maintains per-tab state with estimated savings, and blocks tracker domains via `declarativeNetRequest`.

**Architecture:** A service worker uses non-blocking `chrome.webRequest` to observe requests (the live feed) and a generated `declarativeNetRequest` static ruleset to block them. A pure-TypeScript `lib/` (domain extraction, tracker DB, classifier, estimates, per-tab store) holds all logic and is unit-tested with Vitest in isolation from Chrome APIs. A build script compiles the Tracker Radar domain map into both the runtime JSON DB and the DNR ruleset.

**Tech Stack:** WXT, TypeScript, Vitest, `tldts` (public-suffix/eTLD+1), `@types/chrome`. Targets Chrome (Firefox later).

This is **Plan 1 of 5** (P0). Subsequent plans: P1 Overlay (reveal + ambient skins), P2 Side-panel + popup + lifetime storage, P3 Fingerprint probe, P4 Polish/README/Firefox. See `docs/superpowers/specs/2026-06-22-voyeur-design.md`.

---

## File Structure

```
voyeur/  (repo root = /Users/devgoat/Dev/chrome_extensions)
├── package.json
├── wxt.config.ts                  # WXT config: manifest, permissions, DNR ruleset, srcDir
├── tsconfig.json
├── vitest.config.ts
├── scripts/
│   └── build-tracker-db.ts        # fetch Tracker Radar domain map → compile DB + DNR rules
├── public/
│   └── rules/
│       └── tracker-rules.json     # GENERATED DNR static ruleset (gitignored or committed)
├── src/
│   ├── data/
│   │   └── tracker-radar.json     # GENERATED runtime domain→{company,category} map
│   ├── lib/
│   │   ├── types.ts               # shared types (no logic)
│   │   ├── domains.ts             # eTLD+1 extraction
│   │   ├── domains.test.ts
│   │   ├── tracker-db.ts          # TrackerDB: lookup domain→info
│   │   ├── tracker-db.test.ts
│   │   ├── classifier.ts          # classify(url, db) → Classification | null
│   │   ├── classifier.test.ts
│   │   ├── estimates.ts           # bytes/time/CO2 estimation
│   │   ├── estimates.test.ts
│   │   ├── build-db.ts            # pure transform: raw domain map → {db, rules}
│   │   ├── build-db.test.ts
│   │   ├── tab-store.ts           # per-tab state aggregation
│   │   └── tab-store.test.ts
│   └── entrypoints/
│       └── background.ts          # service worker: observe + classify + store + ports
└── tests/
    └── e2e/
        ├── fixture/               # local page that loads known tracker URLs
        └── engine.spec.ts         # Playwright: load extension, assert classification + block
```

Responsibilities: each `lib/` file is one pure unit behind a typed interface; `background.ts` is the only file that touches `chrome.*`; the build script is the only thing that does network/FS at build time.

---

## Task 1: Scaffold WXT + TypeScript + Vitest

**Files:**
- Create: `package.json`, `wxt.config.ts`, `tsconfig.json`, `vitest.config.ts`, `src/entrypoints/background.ts`

- [ ] **Step 1: Initialize the project and install deps**

Run:
```bash
cd /Users/devgoat/Dev/chrome_extensions
npm init -y
npm install -D wxt typescript vitest @types/chrome
npm install tldts
```

- [ ] **Step 2: Write `wxt.config.ts`**

```ts
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'Voyeur',
    description: 'See who is watching you. Voyeur X-rays and blocks web trackers in real time.',
    permissions: ['webRequest', 'declarativeNetRequest', 'webNavigation', 'storage'],
    host_permissions: ['<all_urls>'],
    declarative_net_request: {
      rule_resources: [
        {
          id: 'tracker_rules',
          enabled: true,
          path: 'rules/tracker-rules.json',
        },
      ],
    },
  },
});
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "extends": "./.wxt/tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "types": ["chrome", "node"]
  },
  "include": ["src", "scripts", "tests", "*.ts"]
}
```

- [ ] **Step 4: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Add scripts to `package.json`**

Merge into `package.json`:
```json
{
  "type": "module",
  "scripts": {
    "dev": "wxt",
    "build": "wxt build",
    "zip": "wxt zip",
    "test": "vitest run",
    "test:watch": "vitest",
    "build:db": "tsx scripts/build-tracker-db.ts",
    "postinstall": "wxt prepare"
  }
}
```
Then run `npm install -D tsx` and `npm run postinstall`.

- [ ] **Step 6: Write a minimal `src/entrypoints/background.ts` so the build succeeds**

```ts
export default defineBackground(() => {
  console.log('[voyeur] background loaded');
});
```

- [ ] **Step 7: Create an empty placeholder ruleset so the manifest is valid**

Create `public/rules/tracker-rules.json`:
```json
[]
```

- [ ] **Step 8: Verify the project builds**

Run: `npm run build`
Expected: WXT build completes, writes `.output/chrome-mv3/` with a `manifest.json` containing the DNR `rule_resources`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold WXT + TS + Vitest project (Voyeur P0)"
```

---

## Task 2: Shared types

**Files:**
- Create: `src/lib/types.ts`

- [ ] **Step 1: Write the types (no logic, no test needed)**

```ts
export type TrackerCategory =
  | 'advertising'
  | 'analytics'
  | 'social'
  | 'session-recording'
  | 'fingerprinting'
  | 'content'
  | 'unknown';

export interface TrackerInfo {
  company: string;
  category: TrackerCategory;
}

export interface TrackerEvent {
  id: string;
  url: string;
  domain: string;
  company: string;
  category: TrackerCategory;
  resourceType: string;
  tabId: number;
  blocked: boolean;
  timestamp: number;
}

export interface TabState {
  tabId: number;
  pageUrl: string;
  events: TrackerEvent[];
  companyCounts: Record<string, number>;
  blockedCount: number;
  bytesSaved: number;
  timeSavedMs: number;
  co2SavedG: number;
}

export type EngineMessage =
  | { type: 'TAB_STATE'; state: TabState }
  | { type: 'TRACKER_EVENT'; event: TrackerEvent };

export type UiMessage =
  | { type: 'GET_TAB_STATE'; tabId: number }
  | { type: 'RESET_TAB'; tabId: number };
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: shared engine types"
```

---

## Task 3: Domain extraction (eTLD+1)

**Files:**
- Create: `src/lib/domains.ts`
- Test: `src/lib/domains.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { eTLDPlusOne } from './domains';

describe('eTLDPlusOne', () => {
  it('extracts the registrable domain from a URL', () => {
    expect(eTLDPlusOne('https://www.google-analytics.com/collect?v=2')).toBe('google-analytics.com');
  });

  it('collapses subdomains', () => {
    expect(eTLDPlusOne('https://stats.g.doubleclick.net/x')).toBe('doubleclick.net');
  });

  it('handles multi-part TLDs', () => {
    expect(eTLDPlusOne('https://cdn.example.co.uk/a.js')).toBe('example.co.uk');
  });

  it('returns null for invalid input', () => {
    expect(eTLDPlusOne('not a url')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/domains.test.ts`
Expected: FAIL — cannot find module `./domains`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { getDomain } from 'tldts';

export function eTLDPlusOne(url: string): string | null {
  const domain = getDomain(url);
  return domain && domain.length > 0 ? domain : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/domains.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/domains.ts src/lib/domains.test.ts
git commit -m "feat: eTLD+1 domain extraction"
```

---

## Task 4: Tracker DB lookup

**Files:**
- Create: `src/lib/tracker-db.ts`
- Test: `src/lib/tracker-db.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { TrackerDB } from './tracker-db';

const fixture = {
  'doubleclick.net': { company: 'Google', category: 'advertising' as const },
  'facebook.com': { company: 'Meta', category: 'social' as const },
};

describe('TrackerDB', () => {
  it('looks up a known domain', () => {
    const db = TrackerDB.fromJson(fixture);
    expect(db.lookup('doubleclick.net')).toEqual({ company: 'Google', category: 'advertising' });
  });

  it('returns null for unknown domain', () => {
    const db = TrackerDB.fromJson(fixture);
    expect(db.lookup('example.com')).toBeNull();
  });

  it('reports its size', () => {
    const db = TrackerDB.fromJson(fixture);
    expect(db.size).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tracker-db.test.ts`
Expected: FAIL — cannot find module `./tracker-db`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { TrackerInfo } from './types';

export type DomainMap = Record<string, TrackerInfo>;

export class TrackerDB {
  private constructor(private readonly map: DomainMap) {}

  static fromJson(json: DomainMap): TrackerDB {
    return new TrackerDB(json);
  }

  lookup(domain: string): TrackerInfo | null {
    return this.map[domain] ?? null;
  }

  get size(): number {
    return Object.keys(this.map).length;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tracker-db.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tracker-db.ts src/lib/tracker-db.test.ts
git commit -m "feat: TrackerDB domain lookup"
```

---

## Task 5: Classifier

**Files:**
- Create: `src/lib/classifier.ts`
- Test: `src/lib/classifier.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { classify } from './classifier';
import { TrackerDB } from './tracker-db';

const db = TrackerDB.fromJson({
  'doubleclick.net': { company: 'Google', category: 'advertising' },
});

describe('classify', () => {
  it('classifies a tracker URL via its eTLD+1', () => {
    expect(classify('https://stats.g.doubleclick.net/p?x=1', db)).toEqual({
      domain: 'doubleclick.net',
      company: 'Google',
      category: 'advertising',
    });
  });

  it('returns null for a non-tracker URL', () => {
    expect(classify('https://www.example.com/index.html', db)).toBeNull();
  });

  it('returns null for an unparseable URL', () => {
    expect(classify('::::', db)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/classifier.test.ts`
Expected: FAIL — cannot find module `./classifier`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { eTLDPlusOne } from './domains';
import type { TrackerDB } from './tracker-db';
import type { TrackerCategory } from './types';

export interface Classification {
  domain: string;
  company: string;
  category: TrackerCategory;
}

export function classify(url: string, db: TrackerDB): Classification | null {
  const domain = eTLDPlusOne(url);
  if (!domain) return null;
  const info = db.lookup(domain);
  if (!info) return null;
  return { domain, company: info.company, category: info.category };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/classifier.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/classifier.ts src/lib/classifier.test.ts
git commit -m "feat: request classifier"
```

---

## Task 6: Savings estimates

**Files:**
- Create: `src/lib/estimates.ts`
- Test: `src/lib/estimates.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { bytesForType, timeSavedMs, co2Grams } from './estimates';

describe('estimates', () => {
  it('returns a known average for a resource type', () => {
    expect(bytesForType('script')).toBe(45000);
  });

  it('falls back to "other" for unknown types', () => {
    expect(bytesForType('totally-unknown')).toBe(bytesForType('other'));
  });

  it('estimates time saved as a fixed cost per request', () => {
    expect(timeSavedMs(3)).toBe(105);
  });

  it('estimates CO2 from bytes', () => {
    // 1 GB at the documented factor
    expect(co2Grams(1_000_000_000)).toBeCloseTo(26, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/estimates.test.ts`
Expected: FAIL — cannot find module `./estimates`.

- [ ] **Step 3: Write minimal implementation**

```ts
// All values are ESTIMATES, documented and surfaced as "estimated" in the UI.
// Average transfer sizes per blocked resource type (bytes). Conservative round numbers.
const AVG_BYTES: Record<string, number> = {
  script: 45000,
  image: 18000,
  xmlhttprequest: 4000,
  sub_frame: 60000,
  ping: 500,
  font: 30000,
  stylesheet: 20000,
  media: 200000,
  other: 8000,
};

// Rough wall-clock cost avoided per blocked request (connection + parse).
const MS_PER_REQUEST = 35;

// Sustainable-web-design-style factor: grams CO2 per gigabyte transferred.
const G_CO2_PER_GB = 26;

export function bytesForType(type: string): number {
  return AVG_BYTES[type] ?? AVG_BYTES.other;
}

export function timeSavedMs(blockedCount: number): number {
  return blockedCount * MS_PER_REQUEST;
}

export function co2Grams(bytes: number): number {
  return (bytes / 1_000_000_000) * G_CO2_PER_GB;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/estimates.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/estimates.ts src/lib/estimates.test.ts
git commit -m "feat: savings estimates (bytes/time/CO2)"
```

---

## Task 7: Build-DB transform (pure)

**Files:**
- Create: `src/lib/build-db.ts`
- Test: `src/lib/build-db.test.ts`

This is the pure transform the build script calls. Input is the Tracker Radar domain map shape; output is our runtime DB plus DNR rules.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildDb, type RawDomainMap } from './build-db';

const raw: RawDomainMap = {
  'doubleclick.net': { owner: { displayName: 'Google' }, categories: ['Advertising'] },
  'hotjar.com': { owner: { displayName: 'Hotjar' }, categories: ['Session Replay'] },
  'orphan.com': { categories: [] },
};

describe('buildDb', () => {
  it('maps owner displayName to company and normalizes category', () => {
    const { db } = buildDb(raw);
    expect(db['doubleclick.net']).toEqual({ company: 'Google', category: 'advertising' });
    expect(db['hotjar.com']).toEqual({ company: 'Hotjar', category: 'session-recording' });
  });

  it('falls back to the domain as company and "unknown" category when owner is missing', () => {
    const { db } = buildDb(raw);
    expect(db['orphan.com']).toEqual({ company: 'orphan.com', category: 'unknown' });
  });

  it('emits one DNR block rule per domain with sequential ids', () => {
    const { rules } = buildDb(raw);
    expect(rules).toHaveLength(3);
    expect(rules[0]).toEqual({
      id: 1,
      priority: 1,
      action: { type: 'block' },
      condition: { urlFilter: '||doubleclick.net^', resourceTypes: expect.any(Array) },
    });
  });

  it('caps rules at the provided maximum', () => {
    const { rules } = buildDb(raw, 2);
    expect(rules).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/build-db.test.ts`
Expected: FAIL — cannot find module `./build-db`.

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/build-db.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/build-db.ts src/lib/build-db.test.ts
git commit -m "feat: pure build-db transform (Tracker Radar -> DB + DNR rules)"
```

---

## Task 8: Build script (fetch + compile dataset)

**Files:**
- Create: `scripts/build-tracker-db.ts`
- Modify: writes `src/data/tracker-radar.json` and `public/rules/tracker-rules.json`

The DuckDuckGo Tracker Radar repo publishes a single combined domain map at
`https://raw.githubusercontent.com/duckduckgo/tracker-radar/main/build-data/generated/domain_map.json`.

- [ ] **Step 1: Write the build script**

```ts
import { writeFile, mkdir } from 'node:fs/promises';
import { buildDb, type RawDomainMap } from '../src/lib/build-db';

const SOURCE =
  'https://raw.githubusercontent.com/duckduckgo/tracker-radar/main/build-data/generated/domain_map.json';

async function main() {
  console.log('[build-db] fetching Tracker Radar domain map...');
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const raw = (await res.json()) as RawDomainMap;
  console.log(`[build-db] ${Object.keys(raw).length} domains`);

  const { db, rules } = buildDb(raw);

  await mkdir('src/data', { recursive: true });
  await mkdir('public/rules', { recursive: true });
  await writeFile('src/data/tracker-radar.json', JSON.stringify(db));
  await writeFile('public/rules/tracker-rules.json', JSON.stringify(rules));

  console.log(`[build-db] wrote ${Object.keys(db).length} DB entries, ${rules.length} DNR rules`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Run the build script**

Run: `npm run build:db`
Expected: prints domain count, writes `src/data/tracker-radar.json` and `public/rules/tracker-rules.json`. Verify `doubleclick.net` exists:
```bash
node -e "const d=require('./src/data/tracker-radar.json'); console.log(d['doubleclick.net'])"
```
Expected: an object with `company` and `category`.

- [ ] **Step 3: Decide on committing generated data**

Commit the generated `src/data/tracker-radar.json` and `public/rules/tracker-rules.json` (so checkouts work without network), and remove them from `.gitignore` if present.

- [ ] **Step 4: Commit**

```bash
git add scripts/build-tracker-db.ts src/data/tracker-radar.json public/rules/tracker-rules.json
git commit -m "feat: build script + generated Tracker Radar DB & DNR ruleset"
```

---

## Task 9: Per-tab store

**Files:**
- Create: `src/lib/tab-store.ts`
- Test: `src/lib/tab-store.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { TabStore } from './tab-store';
import type { TrackerEvent } from './types';

function ev(over: Partial<TrackerEvent> = {}): TrackerEvent {
  return {
    id: 'e1',
    url: 'https://doubleclick.net/x',
    domain: 'doubleclick.net',
    company: 'Google',
    category: 'advertising',
    resourceType: 'script',
    tabId: 7,
    blocked: true,
    timestamp: 1000,
    ...over,
  };
}

describe('TabStore', () => {
  it('initializes a tab', () => {
    const store = new TabStore();
    const state = store.init(7, 'https://news.example');
    expect(state.tabId).toBe(7);
    expect(state.pageUrl).toBe('https://news.example');
    expect(state.events).toEqual([]);
  });

  it('adds an event and updates company counts', () => {
    const store = new TabStore();
    store.init(7, 'https://news.example');
    store.addEvent(ev());
    store.addEvent(ev({ id: 'e2', company: 'Google' }));
    const state = store.get(7)!;
    expect(state.events).toHaveLength(2);
    expect(state.companyCounts.Google).toBe(2);
  });

  it('accumulates blocked count and estimated savings', () => {
    const store = new TabStore();
    store.init(7, 'https://news.example');
    store.addEvent(ev({ blocked: true, resourceType: 'script' }));
    store.addEvent(ev({ id: 'e2', blocked: false, resourceType: 'image' }));
    const state = store.get(7)!;
    expect(state.blockedCount).toBe(1);
    expect(state.bytesSaved).toBe(45000); // only the blocked script counts
    expect(state.timeSavedMs).toBe(35);
    expect(state.co2SavedG).toBeGreaterThan(0);
  });

  it('auto-inits a tab when an event arrives before navigation', () => {
    const store = new TabStore();
    store.addEvent(ev());
    expect(store.get(7)).toBeDefined();
  });

  it('resets a tab', () => {
    const store = new TabStore();
    store.init(7, 'https://news.example');
    store.addEvent(ev());
    store.reset(7);
    expect(store.get(7)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tab-store.test.ts`
Expected: FAIL — cannot find module `./tab-store`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { TabState, TrackerEvent } from './types';
import { bytesForType, timeSavedMs, co2Grams } from './estimates';

export class TabStore {
  private tabs = new Map<number, TabState>();

  get(tabId: number): TabState | undefined {
    return this.tabs.get(tabId);
  }

  init(tabId: number, pageUrl: string): TabState {
    const state: TabState = {
      tabId,
      pageUrl,
      events: [],
      companyCounts: {},
      blockedCount: 0,
      bytesSaved: 0,
      timeSavedMs: 0,
      co2SavedG: 0,
    };
    this.tabs.set(tabId, state);
    return state;
  }

  addEvent(event: TrackerEvent): TabState {
    const state = this.tabs.get(event.tabId) ?? this.init(event.tabId, '');
    state.events.push(event);
    state.companyCounts[event.company] = (state.companyCounts[event.company] ?? 0) + 1;
    if (event.blocked) {
      state.blockedCount += 1;
      state.bytesSaved += bytesForType(event.resourceType);
      state.timeSavedMs = timeSavedMs(state.blockedCount);
      state.co2SavedG = co2Grams(state.bytesSaved);
    }
    return state;
  }

  reset(tabId: number): void {
    this.tabs.delete(tabId);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tab-store.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tab-store.ts src/lib/tab-store.test.ts
git commit -m "feat: per-tab state store with savings aggregation"
```

---

## Task 10: Wire the service worker (observe + classify + store)

**Files:**
- Modify: `src/entrypoints/background.ts`

- [ ] **Step 1: Write the background wiring**

```ts
import trackerRadar from '../data/tracker-radar.json';
import { TrackerDB, type DomainMap } from '../lib/tracker-db';
import { classify } from '../lib/classifier';
import { TabStore } from '../lib/tab-store';
import type { TrackerEvent } from '../lib/types';

export default defineBackground(() => {
  const db = TrackerDB.fromJson(trackerRadar as DomainMap);
  const store = new TabStore();
  let eventSeq = 0;

  // Blocked-inference: any classified domain is also in our DNR blocklist,
  // so a classified request is treated as blocked. (See spec: blocked is inferred.)
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (details.tabId < 0) return; // ignore non-tab requests
      const cls = classify(details.url, db);
      if (!cls) return;
      const event: TrackerEvent = {
        id: `ev_${eventSeq++}`,
        url: details.url,
        domain: cls.domain,
        company: cls.company,
        category: cls.category,
        resourceType: details.type,
        tabId: details.tabId,
        blocked: true,
        timestamp: details.timeStamp,
      };
      const state = store.addEvent(event);
      void chrome.action?.setBadgeText({
        tabId: details.tabId,
        text: String(state.events.length),
      });
    },
    { urls: ['<all_urls>'] },
  );

  chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId !== 0) return; // top frame only
    store.init(details.tabId, details.url);
    void chrome.action?.setBadgeText({ tabId: details.tabId, text: '' });
  });

  chrome.tabs.onRemoved.addListener((tabId) => store.reset(tabId));

  console.log(`[voyeur] engine ready, ${db.size} tracker domains loaded`);
});
```

- [ ] **Step 2: Build and load the extension manually**

Run: `npm run build`
Then in Chrome: `chrome://extensions` → enable Developer mode → "Load unpacked" → select `.output/chrome-mv3`.

- [ ] **Step 3: Verify live classification**

Open a tracker-heavy site (e.g. a news site). Open the service worker console from `chrome://extensions` → Voyeur → "service worker".
Expected: `[voyeur] engine ready, N tracker domains loaded` with N in the thousands, and the toolbar badge shows a rising tracker count on the tab.

- [ ] **Step 4: Commit**

```bash
git add src/entrypoints/background.ts
git commit -m "feat: service worker observes + classifies requests, badge counter"
```

---

## Task 11: Verify DNR actually blocks

**Files:** none (verification + a note)

- [ ] **Step 1: Confirm the ruleset loaded**

In the service worker console run:
```js
chrome.declarativeNetRequest.getEnabledRulesets().then(console.log)
```
Expected: `['tracker_rules']`.

- [ ] **Step 2: Confirm a tracker request is blocked**

On a news site, open DevTools → Network, filter for a known tracker (e.g. `doubleclick`).
Expected: the request shows as blocked/failed (`net::ERR_BLOCKED_BY_CLIENT` or blocked by extension), while the service worker badge still counted it (observe fires before the block).

- [ ] **Step 3: If observe does NOT fire for blocked requests**

If badge counts are zero because DNR cancels before observe: switch the blocked-inference to a blocklist `Set` membership check built from the DB at startup, and keep observe on `onBeforeRequest` (which still fires for observation in MV3). Document the observed behavior in `docs/superpowers/specs/2026-06-22-voyeur-design.md` §17. No code change if Step 2 already shows counted + blocked.

- [ ] **Step 4: Commit any note**

```bash
git add -A
git commit -m "docs: record observed DNR + webRequest ordering" --allow-empty
```

---

## Task 12: Expose tab state via messaging port

**Files:**
- Modify: `src/entrypoints/background.ts`

- [ ] **Step 1: Add a port hub and message handler**

Add inside `defineBackground`, after the listeners:
```ts
const ports = new Set<chrome.runtime.Port>();

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'voyeur') return;
  ports.add(port);
  port.onDisconnect.addListener(() => ports.delete(port));
  port.onMessage.addListener((msg) => {
    if (msg?.type === 'GET_TAB_STATE') {
      const state = store.get(msg.tabId) ?? store.init(msg.tabId, '');
      port.postMessage({ type: 'TAB_STATE', state });
    } else if (msg?.type === 'RESET_TAB') {
      store.reset(msg.tabId);
    }
  });
});

function broadcast(event: TrackerEvent) {
  for (const port of ports) port.postMessage({ type: 'TRACKER_EVENT', event });
}
```
Then call `broadcast(event)` right after `store.addEvent(event)` in the `onBeforeRequest` listener.

- [ ] **Step 2: Build and smoke-test the port from a page console**

Run: `npm run build`, reload the unpacked extension. In the service worker console:
```js
const p = chrome.runtime.connect({ name: 'voyeur' });
p.onMessage.addListener(console.log);
p.postMessage({ type: 'GET_TAB_STATE', tabId: (await chrome.tabs.query({active:true,currentWindow:true}))[0].id });
```
Expected: a `TAB_STATE` message logs with the active tab's state; new `TRACKER_EVENT` messages stream as the page loads trackers.

- [ ] **Step 3: Commit**

```bash
git add src/entrypoints/background.ts
git commit -m "feat: expose per-tab state + event stream over runtime port"
```

---

## Task 13: E2E smoke test (Playwright + loaded extension)

**Files:**
- Create: `tests/e2e/fixture/index.html`, `tests/e2e/fixture/tracker.js`, `tests/e2e/engine.spec.ts`, `playwright.config.ts`
- Modify: `package.json` (add `test:e2e`)

- [ ] **Step 1: Install Playwright**

Run:
```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Create the fixture page that requests a known tracker**

`tests/e2e/fixture/index.html`:
```html
<!doctype html>
<html><head><title>fixture</title></head>
<body>
<h1>fixture</h1>
<img src="https://doubleclick.net/pixel.gif" alt="" />
<script src="https://www.google-analytics.com/analytics.js"></script>
</body></html>
```

- [ ] **Step 3: Write `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: { headless: false },
  timeout: 30000,
});
```

- [ ] **Step 4: Write the failing E2E test**

`tests/e2e/engine.spec.ts`:
```ts
import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(dir, '../../.output/chrome-mv3');

test('engine classifies trackers on a page and reports state', async () => {
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });

  // get the service worker
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');

  const page = await ctx.newPage();
  await page.goto(`file://${path.resolve(dir, 'fixture/index.html')}`);
  await page.waitForTimeout(2000);

  // query the active tab state via the service worker context
  const blockedCount = await sw.evaluate(async () => {
    // @ts-ignore
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return new Promise((resolve) => {
      // @ts-ignore
      const p = chrome.runtime.connect({ name: 'voyeur' });
      p.onMessage.addListener((m: any) => {
        if (m.type === 'TAB_STATE') resolve(m.state.events.length);
      });
      p.postMessage({ type: 'GET_TAB_STATE', tabId: tabs[0].id });
    });
  });

  expect(blockedCount).toBeGreaterThan(0);
  await ctx.close();
});
```

- [ ] **Step 5: Run it to verify it fails first (before a fresh build)**

Run: `rm -rf .output && npx playwright test tests/e2e/engine.spec.ts`
Expected: FAIL — extension path missing / no events.

- [ ] **Step 6: Build then run to pass**

Run: `npm run build && npx playwright test tests/e2e/engine.spec.ts`
Expected: PASS — `blockedCount` > 0 (the fixture's two tracker requests were classified).

- [ ] **Step 7: Add the script and commit**

Add to `package.json` scripts: `"test:e2e": "playwright test"`. Then:
```bash
git add -A
git commit -m "test: e2e smoke — engine classifies trackers on a loaded page"
```

---

## Task 14: README stub

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write a minimal README**

```markdown
# Voyeur

> See who is watching you. Voyeur X-rays and blocks web trackers in real time.

**Status:** P0 (engine) — observes, classifies, and blocks tracker requests per tab.

Privacy-first: zero telemetry, fully local, no phone-home.

## Develop
\`\`\`bash
npm install
npm run build:db   # fetch + compile the tracker dataset
npm run dev        # WXT dev server
npm test           # unit tests
npm run test:e2e   # Playwright smoke
\`\`\`

## How it works
Hybrid MV3 detection: non-blocking \`chrome.webRequest\` gives the live "who is tracking" feed; \`declarativeNetRequest\` does the actual blocking. Classification uses the DuckDuckGo Tracker Radar dataset (Apache-2.0).

## License
MIT (code). Dataset: DuckDuckGo Tracker Radar (Apache-2.0). See \`THIRD_PARTY_LICENSES.md\`.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README for P0 engine"
```

---

## Definition of Done (P0)

- [ ] `npm test` → all unit suites green (domains, tracker-db, classifier, estimates, build-db, tab-store).
- [ ] `npm run build:db` produces a non-trivial `src/data/tracker-radar.json` (thousands of domains) and `public/rules/tracker-rules.json`.
- [ ] `npm run build` produces a loadable `.output/chrome-mv3` whose manifest includes the DNR ruleset.
- [ ] Loaded in Chrome: service worker logs domain count; badge counts trackers on a real site; known tracker requests are blocked in the Network panel.
- [ ] `npm run test:e2e` → engine classifies the fixture's tracker requests (events > 0).

---

## Self-Review notes

- **Spec coverage:** §4 engine, §5 detection/classification, §9 estimates, §11 licensing (Tracker Radar only, no GPL), §13 testing — all have tasks. Surfaces (§6), skins (§7), fingerprinting (§8), side-panel (§6C) are explicitly out of P0 → covered by plans P1–P3.
- **Type consistency:** `TrackerInfo`/`TrackerEvent`/`TabState` defined once in Task 2 and reused; `TrackerDB.fromJson`, `classify`, `TabStore.{init,addEvent,get,reset}`, `bytesForType/timeSavedMs/co2Grams`, `buildDb` signatures are consistent across tasks.
- **Risk carried from spec §17:** blocked-inference (Task 11 Step 3 has the fallback) and DNR rule-count cap (Task 7 `maxRules`, default 25000).
