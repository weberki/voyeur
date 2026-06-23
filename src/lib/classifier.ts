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
