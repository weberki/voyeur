import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(dir, '../../.output/chrome-mv3');

type VoyeurWindow = Window & {
  __voyeurEvents: { tabId: number }[];
  __voyeurPort: chrome.runtime.Port;
};

test('engine classifies trackers on a page and reports state', async () => {
  // headless:false is REQUIRED — Playwright rejects the extension-load args
  // (--disable-extensions-except / --load-extension) unless headless is false.
  // The actual headless rendering is driven by the --headless=new arg below.
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      '--headless=new',
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
    ],
  });

  try {
    let [sw] = ctx.serviceWorkers();
    if (!sw) sw = await ctx.waitForEvent('serviceworker');

    // Get extension ID from SW URL so we can open an extension-origin page.
    const extId = new URL(sw.url()).hostname;

    // IMPORTANT: Open the extension page and connect the port BEFORE navigating to the
    // fixture. MV3 service workers can be terminated when idle; an open port keeps the SW
    // alive so the store state (populated by webRequest events) survives until we query it.
    const extPage = await ctx.newPage();
    await extPage.goto(`chrome-extension://${extId}/background.js`);

    // Connect to the 'voyeur' port and collect streaming TRACKER_EVENTs.
    await extPage.evaluate(() => {
      const w = window as unknown as VoyeurWindow;
      w.__voyeurEvents = [];
      const p = chrome.runtime.connect({ name: 'voyeur' });
      w.__voyeurPort = p;
      p.onMessage.addListener((m: { type: string; event?: { tabId: number } }) => {
        if (m.type === 'TRACKER_EVENT' && m.event) {
          (window as unknown as VoyeurWindow).__voyeurEvents.push(m.event);
        }
      });
    });

    // Navigate the fixture page — webRequest fires → classify → broadcast over port.
    const page = await ctx.newPage();
    await page.goto(`file://${path.resolve(dir, 'fixture/index.html')}`);

    // Event-driven gate: wait for real classified events to stream in, rather than a
    // fixed sleep. This is deterministic and avoids racing the classifier.
    await extPage.waitForFunction(
      () => (window as unknown as VoyeurWindow).__voyeurEvents.length > 0,
      { timeout: 10_000 },
    );

    // Derive the fixture's tabId from a real streamed event, NOT from
    // chrome.tabs.query({active,currentWindow}) — a service worker has no "current
    // window", so that query is nondeterministic and can return the wrong tab.
    const tabId = await extPage.evaluate(
      () => (window as unknown as VoyeurWindow).__voyeurEvents[0].tabId,
    );

    // Query TAB_STATE via the already-open port (SW is alive, store is populated).
    // This exercises the real port request/reply protocol end-to-end.
    const eventsLength = await extPage.evaluate(
      async (tid: number) => {
        const port = (window as unknown as VoyeurWindow).__voyeurPort;
        return new Promise<number>((resolve, reject) => {
          const handler = (m: { type: string; state: { events: unknown[] } }) => {
            if (m.type === 'TAB_STATE') {
              port.onMessage.removeListener(handler);
              resolve(m.state.events.length);
            }
          };
          port.onMessage.addListener(handler);
          port.postMessage({ type: 'GET_TAB_STATE', tabId: tid });
          setTimeout(() => reject(new Error('timeout waiting for TAB_STATE')), 5000);
        });
      },
      tabId,
    );

    expect(eventsLength).toBeGreaterThan(0);
  } finally {
    await ctx.close();
  }
});
