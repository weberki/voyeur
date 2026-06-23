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
