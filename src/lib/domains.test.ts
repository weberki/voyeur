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
