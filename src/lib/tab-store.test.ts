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
    expect(state.bytesSaved).toBe(45000);
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
