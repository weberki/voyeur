/// <reference types="chrome" />
import trackerRadar from '../data/tracker-radar.json';
import blockedDomains from '../data/blocked-domains.json';
import { TrackerDB, type DomainMap } from '../lib/tracker-db';
import { classify } from '../lib/classifier';
import { TabStore } from '../lib/tab-store';
import type { TrackerEvent } from '../lib/types';

export default defineBackground(() => {
  const db = TrackerDB.fromJson(trackerRadar as unknown as DomainMap);
  const blockedSet = new Set<string>(blockedDomains as string[]);
  const store = new TabStore();
  const ports = new Set<chrome.runtime.Port>();
  let eventSeq = 0;

  function broadcast(event: TrackerEvent) {
    for (const port of ports) port.postMessage({ type: 'TRACKER_EVENT', event });
  }

  // OBSERVE (non-blocking): live feed of every request; classify + store + badge.
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (details.tabId < 0) return; // ignore non-tab (e.g. SW/prefetch) requests
      const cls = classify(details.url, db);
      if (!cls) return;
      const event: TrackerEvent = {
        id: `ev_${eventSeq++}`,
        url: details.url,
        domain: cls.domain,
        company: cls.company,
        category: cls.category,
        resourceType: details.type,
        tabId: details.tabId,
        blocked: blockedSet.has(cls.domain), // inferred: in our DNR blocklist
        timestamp: details.timeStamp,
      };
      const state = store.addEvent(event);
      broadcast(event);
      void chrome.action?.setBadgeText({
        tabId: details.tabId,
        text: state.events.length > 999 ? '999+' : String(state.events.length),
      });
    },
    { urls: ['<all_urls>'] },
  );

  // New top-frame navigation resets that tab's state + badge.
  chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId !== 0) return; // top frame only
    store.init(details.tabId, details.url);
    void chrome.action?.setBadgeText({ tabId: details.tabId, text: '' });
  });

  chrome.tabs.onRemoved.addListener((tabId) => store.reset(tabId));

  // UI port: stream events + answer state queries.
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'voyeur') return;
    ports.add(port);
    port.onDisconnect.addListener(() => ports.delete(port));
    port.onMessage.addListener((msg) => {
      if (msg?.type === 'GET_TAB_STATE') {
        const state = store.get(msg.tabId) ?? store.init(msg.tabId, '');
        port.postMessage({ type: 'TAB_STATE', state });
      } else if (msg?.type === 'RESET_TAB') {
        store.reset(msg.tabId);
      }
    });
  });

  void chrome.action?.setBadgeBackgroundColor({ color: '#d7263d' });
  console.log(
    `[voyeur] engine ready, ${db.size} tracker domains loaded, ${blockedSet.size} blockable`,
  );
});
