import type { TabState, TrackerEvent } from './types';
import { bytesForType, timeSavedMs, co2Grams } from './estimates';

export class TabStore {
  private tabs = new Map<number, TabState>();

  get(tabId: number): TabState | undefined {
    return this.tabs.get(tabId);
  }

  init(tabId: number, pageUrl: string): TabState {
    const state: TabState = {
      tabId,
      pageUrl,
      events: [],
      companyCounts: {},
      blockedCount: 0,
      bytesSaved: 0,
      timeSavedMs: 0,
      co2SavedG: 0,
    };
    this.tabs.set(tabId, state);
    return state;
  }

  addEvent(event: TrackerEvent): TabState {
    const state = this.tabs.get(event.tabId) ?? this.init(event.tabId, '');
    state.events.push(event);
    state.companyCounts[event.company] = (state.companyCounts[event.company] ?? 0) + 1;
    if (event.blocked) {
      state.blockedCount += 1;
      state.bytesSaved += bytesForType(event.resourceType);
      state.timeSavedMs = timeSavedMs(state.blockedCount);
      state.co2SavedG = co2Grams(state.bytesSaved);
    }
    return state;
  }

  reset(tabId: number): void {
    this.tabs.delete(tabId);
  }
}
