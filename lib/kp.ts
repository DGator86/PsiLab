/**
 * Planetary K-index (geomagnetic activity) from NOAA SWPC, cached per
 * warm lambda for 30 minutes. Best-effort: returns null on any failure
 * so it never blocks a drill.
 */
let cache: { value: number | null; fetchedAt: number } = { value: null, fetchedAt: 0 };
const TTL_MS = 30 * 60 * 1000;

export async function getCurrentKp(): Promise<number | null> {
  if (Date.now() - cache.fetchedAt < TTL_MS) return cache.value;
  try {
    const res = await fetch(
      "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json",
      { signal: AbortSignal.timeout(3000), next: { revalidate: 1800 } },
    );
    if (!res.ok) throw new Error(String(res.status));
    // Format: [["time_tag","Kp","a_running","station_count"], ["2026-06-12 12:00:00","2.33",...], ...]
    const rows: string[][] = await res.json();
    const last = rows[rows.length - 1];
    const kp = Number.parseFloat(last?.[1] ?? "");
    cache = { value: Number.isFinite(kp) ? kp : null, fetchedAt: Date.now() };
  } catch {
    cache = { value: null, fetchedAt: Date.now() };
  }
  return cache.value;
}

export const KP_QUIET_THRESHOLD = 3;
