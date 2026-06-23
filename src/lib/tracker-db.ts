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
