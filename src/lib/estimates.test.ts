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
    expect(co2Grams(1_000_000_000)).toBeCloseTo(26, 0);
  });
});
