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

  describe('CATEGORY_MAP — real TDS vocabulary', () => {
    it('maps "Action Pixels" to "advertising"', () => {
      const { db } = buildDb({ 'pixel.example.com': { categories: ['Action Pixels'] } });
      expect(db['pixel.example.com'].category).toBe('advertising');
    });
    it('maps "Social - Share" to "social"', () => {
      const { db } = buildDb({ 'share.example.com': { categories: ['Social - Share'] } });
      expect(db['share.example.com'].category).toBe('social');
    });
    it('maps "Tag Manager" to "analytics"', () => {
      const { db } = buildDb({ 'gtm.example.com': { categories: ['Tag Manager'] } });
      expect(db['gtm.example.com'].category).toBe('analytics');
    });
    it('falls back to "content" for unmapped categories like "Embedded Content"', () => {
      const { db } = buildDb({ 'cdn.example.com': { categories: ['Embedded Content'] } });
      expect(db['cdn.example.com'].category).toBe('content');
    });
  });
});
