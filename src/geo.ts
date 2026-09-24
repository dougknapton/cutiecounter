import { config } from './config';

export type Coords = { lat: number; lng: number } | null;

let last: { coords: Coords; at: number } | null = null;
let inflight: Promise<Coords> | null = null;

function round(n: number): number {
  if (!config.roundCoordinates) return n;
  const f = 10 ** config.coordinateDecimals;
  return Math.round(n * f) / f;
}

/** Ask for a fresh position. Resolves to null on denial, timeout or no support; never rejects. */
function fetchPosition(): Promise<Coords> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  if (inflight) return inflight;
  inflight = new Promise<Coords>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) };
        last = { coords, at: Date.now() };
        resolve(coords);
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: config.locationMaxAgeMs },
    );
  }).finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Start a location request early (first launch, tapping Next) so Submit rarely waits. */
export function warmLocation(): void {
  void fetchPosition();
}

/** Best location available within `config.locationWaitMs`, or null. */
export async function getLocationForEntry(): Promise<Coords> {
  if (last && last.coords && Date.now() - last.at < config.locationMaxAgeMs) return last.coords;
  const timeout = new Promise<Coords>((r) => setTimeout(() => r(last?.coords ?? null), config.locationWaitMs));
  return Promise.race([fetchPosition(), timeout]);
}
