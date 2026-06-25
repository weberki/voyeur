# Voyeur

[English](README.md) · **Deutsch**

Sieh, wer dich beobachtet. Voyeur röntgt und blockt Web-Tracker in Echtzeit.

**Status:** P0 (Engine) — beobachtet, klassifiziert und blockt Tracker-Requests pro Tab.

> **Privacy-first. Null Telemetrie. Vollständig lokal. Kein Phone-Home.**
> Die gesamte Klassifizierung läuft in der Browser-Extension — zu keinem Zeitpunkt
> verlassen Daten dein Gerät.

---

## Entwicklung

```bash
npm install             # Abhängigkeiten installieren
npm run build:db        # DuckDuckGo-Tracker-Datensatz holen + kompilieren
npm run dev             # WXT-Dev-Server (Extension mit Hot-Reload in Chrome)
npm test                # Unit-Tests (Vitest)
npm run test:e2e        # Playwright-E2E-Smoke-Test (lädt die echte Extension in Chromium)
```

> `npm run build:db` benötigt Netzwerkzugriff, um das DuckDuckGo TDS zu laden. Einmal
> nach dem Klonen ausführen — und später jederzeit, wenn du eine frische
> Tracker-Datenbank willst.

## Funktionsweise

Voyeur nutzt einen hybriden MV3-Erkennungsansatz:

- **`chrome.webRequest.onBeforeRequest`** — nicht-blockierender Beobachter, der in dem
  Moment feuert, in dem der Browser einen Request startet. Jeder Request wird gegen den
  gebündelten DuckDuckGo Tracker Data Set klassifiziert; Treffer werden pro Tab
  gespeichert und über einen benannten Runtime-Port (`voyeur`) an jede verbundene UI
  gesendet. Das liefert den Live-Feed „wer trackt dich gerade".

- **`declarativeNetRequest`** — deklaratives Regelset, aus demselben TDS kompiliert, das
  das eigentliche Blocken übernimmt. DNR-Regeln laufen nativ im Browser ohne
  Skript-Beteiligung, daher ist das Blocken schnell und kann von der Seite nicht
  abgefangen werden.

Die beiden Mechanismen ergänzen sich: `webRequest` sagt dir, _was_ getrackt wird;
`declarativeNetRequest` _stoppt_ es.

Die Klassifizierung nutzt den **DuckDuckGo Tracker Data Set** (TDS), der zur Build-Zeit
via `npm run build:db` geladen und nach `src/data/` + `public/rules/` kompiliert wird.
Die Engine selbst ist datensatz-agnostisch hinter der `buildDb()`-Schnittstelle — du
kannst also bei Bedarf eine andere Quelle einsetzen.

## Lizenz

**Code:** MIT.

**Gebündelte Daten:** DuckDuckGo Tracker Data Set (TDS), lizenziert unter
**CC BY-NC-SA 4.0 (NonCommercial)** — © DuckDuckGo, Inc. Der gebündelte Datensatz darf
**nicht kommerziell** genutzt werden, und Derivate müssen unter derselben Lizenz geteilt
werden. Für einen kommerziellen Build den Datensatz aus einer permissiv lizenzierten
Quelle neu generieren — die Engine ist datensatz-agnostisch hinter `buildDb()`.

Siehe [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md) für den vollständigen Hinweis.
