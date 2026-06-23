export type TrackerCategory =
  | 'advertising'
  | 'analytics'
  | 'social'
  | 'session-recording'
  | 'fingerprinting'
  | 'content'
  | 'unknown';

export interface TrackerInfo {
  company: string;
  category: TrackerCategory;
}

export interface TrackerEvent {
  id: string;
  url: string;
  domain: string;
  company: string;
  category: TrackerCategory;
  resourceType: string;
  tabId: number;
  blocked: boolean;
  timestamp: number;
}

export interface TabState {
  tabId: number;
  pageUrl: string;
  events: TrackerEvent[];
  companyCounts: Record<string, number>;
  blockedCount: number;
  bytesSaved: number;
  timeSavedMs: number;
  co2SavedG: number;
}

export type EngineMessage =
  | { type: 'TAB_STATE'; state: TabState }
  | { type: 'TRACKER_EVENT'; event: TrackerEvent };

export type UiMessage =
  | { type: 'GET_TAB_STATE'; tabId: number }
  | { type: 'RESET_TAB'; tabId: number };
