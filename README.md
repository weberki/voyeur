# Voyeur

See who is watching you. Voyeur X-rays and blocks web trackers in real time.

**Status:** P0 (engine) — observes, classifies, and blocks tracker requests per tab.

> **Privacy-first. Zero telemetry. Fully local. No phone-home.**
> All classification runs in the browser extension with no data ever leaving your machine.

---

## Develop

```bash
npm install             # install dependencies
npm run build:db        # fetch + compile the DuckDuckGo tracker dataset
npm run dev             # WXT dev server (hot-reload extension in Chrome)
npm test                # unit tests (Vitest)
npm run test:e2e        # Playwright E2E smoke test (loads real extension in Chromium)
```

> `npm run build:db` requires network access to fetch the DuckDuckGo TDS. Run it once
> after cloning and again whenever you want a fresh tracker database.

## How it works

Voyeur uses a hybrid MV3 detection approach:

- **`chrome.webRequest.onBeforeRequest`** — non-blocking observer that fires the instant
  the browser initiates any request. Each request is classified against the bundled
  DuckDuckGo Tracker Data Set; matching entries are stored per-tab and broadcast to any
  connected UI via a named runtime port (`voyeur`). This provides the live "who is
  tracking you" feed.

- **`declarativeNetRequest`** — declarative ruleset compiled from the same TDS that does
  the actual request blocking. DNR rules run natively in the browser without script
  involvement, so blocking is fast and cannot be intercepted by the page.

The two mechanisms are complementary: `webRequest` tells you _what_ is being tracked;
`declarativeNetRequest` _stops_ it.

Classification uses the **DuckDuckGo Tracker Data Set** (TDS), fetched at build time via
`npm run build:db` and compiled into `src/data/` + `public/rules/`. The engine itself is
dataset-agnostic behind the `buildDb()` interface, so you can swap in a different source
if needed.

## License

**Code:** MIT.

**Bundled data:** DuckDuckGo Tracker Data Set (TDS), licensed
**CC BY-NC-SA 4.0 (NonCommercial)** — © DuckDuckGo, Inc. The bundled dataset may not be
used commercially, and derivatives must be shared under the same license. For a commercial
build, regenerate the dataset from a permissively-licensed source — the engine is
dataset-agnostic behind `buildDb()`.

See [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md) for the full notice.
