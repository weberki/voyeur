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
