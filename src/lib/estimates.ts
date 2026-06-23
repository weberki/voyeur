// All values are ESTIMATES, documented and surfaced as "estimated" in the UI.
// Average transfer sizes per blocked resource type (bytes). Conservative round numbers.
const AVG_BYTES: Record<string, number> = {
  script: 45000,
  image: 18000,
  xmlhttprequest: 4000,
  sub_frame: 60000,
  ping: 500,
  font: 30000,
  stylesheet: 20000,
  media: 200000,
  other: 8000,
};

// Rough wall-clock cost avoided per blocked request (connection + parse).
const MS_PER_REQUEST = 35;

// Sustainable-web-design-style factor: grams CO2 per gigabyte transferred.
const G_CO2_PER_GB = 26;

export function bytesForType(type: string): number {
  return AVG_BYTES[type] ?? AVG_BYTES.other;
}

export function timeSavedMs(blockedCount: number): number {
  return blockedCount * MS_PER_REQUEST;
}

export function co2Grams(bytes: number): number {
  return (bytes / 1_000_000_000) * G_CO2_PER_GB;
}
