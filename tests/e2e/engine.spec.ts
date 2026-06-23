import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(dir, '../../.output/chrome-mv3');

type VoyeurWindow = Window & {
  __voyeurEvents: unknown[];
  __voyeurPort: chrome.runtime.Port;
};

test('engine classifies trackers on a page and reports state', async () => {
  // --headless=new is required for loading extensions in headless mode.
  // headless:false is set here to satisfy Playwright's "must be false to use args"
  // constraint; the actual headless rendering is driven by the --headless=new flag.
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      '--headless=new',
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
    ],
  });

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
    p.onMessage.addListener((m: { type: string; event?: unknown }) => {
      if (m.type === 'TRACKER_EVENT') {
        (window as unknown as VoyeurWindow).__voyeurEvents.push(m.event);
      }
    });
  });

  // Navigate the fixture page — webRequest fires → classify → broadcast over port.
  const page = await ctx.newPage();
  await page.goto(`file://${path.resolve(dir, 'fixture/index.html')}`);
  await page.waitForTimeout(2000);

  // Get the active tab ID from the SW context.
  const tabId = await sw.evaluate(async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0]?.id ?? null;
  });

  // Query TAB_STATE via the already-open port (SW is alive, store is populated).
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
    tabId as number,
  );

  expect(eventsLength).toBeGreaterThan(0);
  await ctx.close();
});
