# Voyeur — Design Spec

> **Tagline:** *Du beobachtest die Beobachter.*
> A Chrome/Firefox extension that makes web tracking **visible and satisfying** — it X-rays who is watching you in real time, and blocks them.

- **Status:** Design approved (brainstorm) — ready for implementation plan
- **Date:** 2026-06-22
- **Repo slug:** `voyeur`
- **License:** MIT (code) — see [Licensing](#licensing)

---

## 1. Vision & why this wins

Classic adblockers fail as a showcase project for three reasons: Manifest V3 gutted them (`webRequestBlocking` is gone), the category is brutally saturated (uBlock Origin, AdGuard), and **good adblocking is invisible** — a clean page is not a TikTok moment.

Voyeur flips this: instead of silently removing things, it turns **privacy into a spectacle**. Press a hotkey and the page dims while every tracker lights up at its source — "14 companies are watching you *right now*." That transformation is the viral, muteable, 10-second money shot. It also genuinely blocks.

Independently validated: an autonomous idea-research swarm ranked this concept #2 of 15 ("Tracker Aquarium", 34/40), and the same "page dims → reveal cascades in" mechanic appeared in the #1 and #4 ideas. The viral mechanism is triple-validated.

**Audiences (dual showcase):**
- **TikTok / YT Shorts** → the Aquarium skin (oddly-satisfying, playful).
- **GitHub / dev / security** → the Hacker-HUD skin (credible security tool) + an editable community ruleset (SponsorBlock-style network effect → stars compound over time).

## 2. Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| Core concept | Tracker X-Ray (see + block, **visibly**) | Solves the "invisible = un-viral" problem |
| Scope | Full Suite: A Reveal + B Ambient + C Side-Panel | One shared engine, three surfaces |
| Detection | **Hybrid**: `webRequest` (observe) for live feed + `declarativeNetRequest` for blocking | Only way to get a live per-request feed *and* real blocking under MV3 |
| Stack | **WXT + TypeScript** | Modern MV3 DX, HMR, one codebase → Chrome + Firefox + Edge |
| Skins | **Both**, switchable theme | Aquarium = virality, HUD = credibility |
| Name | **Voyeur** | Memorable, provocative, great clip title |

## 3. Goals & non-goals

**Goals**
- Real-time visibility of every tracker request, mapped to the company behind it.
- A jaw-dropping full-page "reveal" that works muted in <15s.
- Actual blocking via DNR (not just observation).
- Two switchable skins sharing one data layer.
- A dashboard with credible, clearly-estimated stats (requests blocked, MB / time / CO₂ saved).
- Be a *model* privacy tool: **zero telemetry, fully local, no phone-home.**

**Non-goals (YAGNI)**
- Not trying to out-block uBlock Origin on coverage — blocking is "good enough + visible," not exhaustive.
- No cosmetic/element-hiding filter engine in v1 (GPL list complexity; revisit later).
- No account, no cloud sync, no server component.
- No custom filter-syntax parser — we compile rules from open datasets.

## 4. Architecture

### Data flow
```
Webpage fires network requests
   ├─ chrome.webRequest  (OBSERVE, non-blocking)  → live "who is tracking" stream
   └─ declarativeNetRequest (BLOCK via rulesets)  → actual blocking
                          ▼
                Service Worker / Engine
                • classify each request against Tracker DB (domain → company/category)
                • maintain per-tab state + aggregate lifetime stats
                          │  (long-lived Ports / runtime messaging)
        ┌─────────────────┼───────────────────────────┐
        ▼                 ▼                             ▼
  Content Script      Side Panel (C)                 Popup
   A: Reveal overlay   live feed, company ranking,    quick toggle +
   B: Aquarium / HUD   MB / time / CO₂ saved          lifetime counter
        ▲
        │  window.postMessage
   Injected Page-Script → fingerprint detection (canvas / webgl / font)
```

### Components (each isolated, single purpose)

| Module | Responsibility | Depends on |
|---|---|---|
| `engine/` (service worker) | webRequest-observe listeners, DNR rule registration, request classifier, per-tab store, stats aggregator, port hub | `tracker-db`, `storage` |
| `tracker-db/` | bundled DuckDuckGo Tracker Radar (domain→company/category) + build-time pipeline that compiles it to DNR rulesets | — |
| `overlay/` (content script, Shadow DOM) | renders A (reveal) + B (ambient); maps tracker events → DOM elements; reads `theme` | engine (port) |
| `overlay/renderers/` | `AquariumRenderer` + `HudRenderer` implementing one `OverlayRenderer` interface | — |
| `probe/` (injected page-script) | fingerprinting detection in page context, reports via postMessage | — |
| `panel/` (side panel) | dashboard C: live feed, ranking, estimated savings | engine (port) |
| `popup/` | enable/disable toggle, theme switch, lifetime stats | storage |
| `storage/` | wraps `chrome.storage` for settings + lifetime aggregates | — |

**Isolation test:** each module is usable behind a typed interface; the engine never imports a renderer, renderers never import `chrome.webRequest`. Skins are swappable without touching the engine.

## 5. Detection & classification

### The hybrid
- **Observe (visibility):** `chrome.webRequest.onBeforeRequest` / `onBeforeSendHeaders` in **non-blocking** mode is still permitted under MV3. This is the live stream that feeds every UI. For each request we get `url`, `type` (image/script/sub_frame/xhr…), `tabId`, `initiator`/`documentUrl`.
- **Block (action):** `declarativeNetRequest` static rulesets generated from the tracker dataset. DNR gives no production per-request feedback (`onRuleMatchedDebug` is dev-only), so we **infer "blocked"** by cross-referencing: a request matched by our ruleset that we *also* saw start but never complete → mark blocked. Observe + DNR together reconstruct the blocked/allowed picture.

### Classification
- `domain → { company, category }` lookup compiled from **DuckDuckGo Tracker Radar** into a fast in-memory map (hashed eTLD+1).
- Categories drive color/severity (advertising, analytics, session-recording, fingerprinting, social).

### Request → on-page element mapping (for the Reveal)
- Content script keeps a live index (via `MutationObserver`) of elements with external URLs: `img, iframe, script, link, video, source, embed`.
- On reveal, for each tracker event: find the matching element by eTLD+1; pin a badge at its `getBoundingClientRect()`.
- Requests with **no** DOM element (xhr, beacons, pixels) are listed in the corner panel so nothing is lost.

## 6. The three surfaces

### A — Full-page X-Ray Reveal (the money shot)
- Triggered by hotkey (`Alt+X`, configurable) or toolbar click.
- Page dims (Shadow-DOM scrim); tracker markers cascade in (pins in HUD skin, fish-spotlight in Aquarium skin); corner counter "N companies watching you."
- Zoomable focus on a single tracker ("Meta Pixel — watching"). ESC to dismiss.

### B — Ambient surface (always-on, optional)
- **Aquarium skin:** each tracker = a fish in a small corner tank that "looks at" the user; a guardian fish eats blocked trackers one by one; calm tank = clean page. Live "N in tank" count.
- **HUD skin:** corner threat-feed killfeed streaming `⊘ domain  category` lines + live counter + "X MB · Y s saved."
- Toggleable; off by default to respect users who only want the reveal.

### C — Side-Panel Mission Control
- Chrome `sidePanel`: live request feed, company ranking (with counts), estimated MB / time / CO₂ saved this page, and lifetime totals. The depth that earns forks.

## 7. Skin / theme system
- `theme: 'aquarium' | 'hud'` in `chrome.storage`, switchable in popup.
- One `OverlayRenderer` interface (`mount`, `onTrackerEvent`, `reveal`, `unmount`), two implementations. Engine + data identical across skins; only the render layer differs. (HUD may ship Phase 1, Aquarium Phase 1.5 if needed — both are committed.)

## 8. Fingerprinting detection
- Injected page-script (via `web_accessible_resources`, runs in page context) instruments `HTMLCanvasElement.prototype.toDataURL/getImageData`, `WebGLRenderingContext` parameter reads, and font enumeration patterns.
- Heuristic "probe detected" events flow to the content script → counted and shown with a distinct (amber) severity. Detection only — no blocking of fingerprinting in v1.

## 9. Stats estimation
- Constants in `engine/estimates.ts`, each documented: average bytes per blocked request by `type`, average ms saved per blocked request, gCO₂ per GB.
- `bytesSaved = Σ avgBytes[type]`; `timeSaved`, `co2Saved` derived. **Every stat is labeled "geschätzt / estimated"** in the UI — credibility matters.

## 10. Privacy stance (non-negotiable)
- **Zero telemetry. No analytics. No external network calls** except an explicit, user-initiated ruleset update.
- All state local (`chrome.storage` + in-memory). A privacy tool that phones home is a star-killer and hypocritical. This is stated prominently in the README.

## 11. Licensing
- **Our code: MIT.**
- **DuckDuckGo Tracker Radar: Apache-2.0** — compatible; bundled with attribution. Used for both classification and to generate DNR block rules → keeps the whole shipped artifact MIT/Apache-clean.
- **EasyList/EasyPrivacy: GPLv3 / CC-BY-SA** — **not bundled** in v1 to avoid copyleft on the codebase. Optional opt-in download later, kept as a separate artifact.
- `THIRD_PARTY_LICENSES.md` lists all datasets + licenses.

## 12. OSS / showcase shape
- `README.md` leading with the demo GIF + "How it works" + the MV3-observe-vs-block insight (devs love the technical honesty).
- Editable tracker ruleset in-repo → community PRs (SponsorBlock-style network effect).
- One short clip per release; the reveal is the recurring hero shot.
- `CONTRIBUTING.md`, issue templates, MIT badge.

## 13. Testing strategy
- **Unit:** classifier (domain→company), DNR rule generation, stats estimator.
- **Integration (Playwright + Chromium with extension loaded):** a local fixture server serves a page that requests known tracker domains; assert (a) events captured, (b) blocked inference correct, (c) overlay renders markers, (d) side panel counts match.
- **Manual demo check:** the 13-second demo script (below) reproduces on a real news site.

## 14. Build & release
- WXT project; targets `chrome` + `firefox` (+ `edge`) from one codebase.
- `wxt build` / `wxt zip` for store packaging; GitHub Action for CI (lint, test, build).

## 15. Phasing (build order — full suite, sequenced)
- **P0 — Engine:** WXT scaffold, manifest, Tracker Radar → DNR pipeline, SW observe + classify + per-tab store. *Verify: console shows classified events per tab.*
- **P1 — Overlay:** content script, `OverlayRenderer` interface, **HUD** ambient (B) + **Reveal** (A). *Verify: hotkey dims page + pins markers on a real site.*
- **P1.5 — Aquarium renderer.** *Verify: theme switch flips skin live.*
- **P2 — Side panel (C) + popup + lifetime storage.** *Verify: counts match engine; survive reload.*
- **P3 — Fingerprint probe.** *Verify: canvas-probe page raises an event.*
- **P4 — Polish:** README + demo GIF, community ruleset, Firefox build, tests green.

## 16. The viral demo script (target, 13s, muted)
1. **0–2s:** a clean, professional news site finishes loading; toolbar badge at 0.
2. **2–4s:** badge spins `0 → 14`; oversized cursor clicks (or hotkey overlay flashes `Alt+X`).
3. **4–7s:** page snaps dim; tracker markers **cascade** in onto exact elements — "Google Ads", "Meta Pixel", "TikTok".
4. **7–11s:** camera pushes in on one pin — "Meta Pixel — watching you." (Aquarium: guardian fish eats it.)
5. **11–13s:** counter stamps "14 companies were watching. Now: 0." Hard cut on the clean tank/page. Loops.

## 17. Open questions / risks
- **Blocked-inference accuracy:** DNR-no-feedback means "blocked" is inferred. Risk: mislabels. Mitigation: conservative inference + label counts as estimated; revisit if `onRuleMatchedDebug` ships for production.
- **Reveal element-mapping coverage:** beacons/xhr have no element. Accepted: shown in corner list, not pinned.
- **Tracker Radar freshness:** dataset ages. Mitigation: build-time refresh + optional in-app update.
- **Aquarium performance:** many fish + animation. Mitigation: cap rendered fish, aggregate overflow into a count.
- **Store review:** broad host permissions + webRequest can draw scrutiny. Mitigation: clear justification, minimal permissions, no remote code.
```
