# Third-Party Licenses

Voyeur's own source code is licensed under the MIT License.

## Bundled data — DuckDuckGo Tracker Data Set (TDS)

The generated files `src/data/tracker-radar.json`, `src/data/blocked-domains.json`,
and `public/rules/tracker-rules.json` are compiled from the DuckDuckGo Tracker Data Set.

- **Source:** https://staticcdn.duckduckgo.com/trackerblocking/v2.1/tds.json
  (built from the DuckDuckGo Tracker Radar — https://github.com/duckduckgo/tracker-radar)
- **License:** Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
  (CC BY-NC-SA 4.0) — https://creativecommons.org/licenses/by-nc-sa/4.0/
- **Copyright:** © DuckDuckGo, Inc.

> **NonCommercial notice:** The bundled tracker dataset is CC BY-NC-SA 4.0. Voyeur's
> code is MIT-licensed, but the bundled DuckDuckGo data may **not** be used commercially,
> and data derivatives must be shared under the same license. For a commercially-usable
> build, regenerate the dataset from a permissively-licensed source — the engine is
> dataset-agnostic behind `buildDb()`.
