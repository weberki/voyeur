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
