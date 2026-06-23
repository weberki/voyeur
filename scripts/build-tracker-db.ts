import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { buildDb, type RawDomainMap, type RawEntry } from '../src/lib/build-db';

const SOURCE = 'https://staticcdn.duckduckgo.com/trackerblocking/v2.1/tds.json';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

interface TdsEntry extends RawEntry {
  default?: string;
}
interface Tds {
  trackers: Record<string, TdsEntry>;
}

async function main() {
  console.log('[build-db] fetching DuckDuckGo TDS...');
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const tds = (await res.json()) as Tds;
  const trackers = tds.trackers;
  console.log(`[build-db] ${Object.keys(trackers).length} trackers`);

  // Classification DB: ALL trackers.
  const { db } = buildDb(trackers as RawDomainMap);

  // DNR rules + blocked set: only DDG's block-default trackers.
  const blockRaw: RawDomainMap = {};
  for (const [domain, entry] of Object.entries(trackers)) {
    if (entry.default === 'block') blockRaw[domain] = entry;
  }
  const { rules } = buildDb(blockRaw);
  const blockedDomains = Object.keys(blockRaw);

  await mkdir(resolve(ROOT, 'src/data'), { recursive: true });
  await mkdir(resolve(ROOT, 'public/rules'), { recursive: true });
  await writeFile(resolve(ROOT, 'src/data/tracker-radar.json'), JSON.stringify(db));
  await writeFile(resolve(ROOT, 'src/data/blocked-domains.json'), JSON.stringify(blockedDomains));
  await writeFile(resolve(ROOT, 'public/rules/tracker-rules.json'), JSON.stringify(rules));

  console.log(
    `[build-db] wrote ${Object.keys(db).length} DB entries, ${rules.length} DNR rules, ${blockedDomains.length} blocked domains`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
