import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentKp } from "@/lib/kp";

type Aircraft = { callsign: string; altitudeM: number | null; originCountry: string };
type Launch = { name: string; net: string; pad: string };

async function nearbyAircraft(lat: number, lon: number): Promise<Aircraft[] | null> {
  try {
    const d = 1.5; // ~165km box
    const url = `https://opensky-network.org/api/states/all?lamin=${lat - d}&lomin=${lon - d}&lamax=${lat + d}&lomax=${lon + d}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const states: unknown[][] = data?.states ?? [];
    return states.slice(0, 12).map((s) => ({
      callsign: typeof s[1] === "string" ? s[1].trim() || "(no callsign)" : "(unknown)",
      altitudeM: typeof s[7] === "number" ? Math.round(s[7]) : null,
      originCountry: typeof s[2] === "string" ? s[2] : "",
    }));
  } catch {
    return null;
  }
}

async function upcomingLaunches(): Promise<Launch[] | null> {
  try {
    const res = await fetch("https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=5&mode=list", {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const results: Record<string, unknown>[] = data?.results ?? [];
    return results.map((r) => ({
      name: typeof r.name === "string" ? r.name : "Unknown launch",
      net: typeof r.net === "string" ? r.net : "",
      pad: typeof r.location === "string" ? r.location : "",
    }));
  } catch {
    return null;
  }
}

/**
 * Auto-debunk context for a sky-watch session. Every source is keyless and
 * failure-tolerant: a null section means "couldn't check", never an error.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No user session" }, { status: 401 });
  }
  const lat = Number.parseFloat(request.nextUrl.searchParams.get("lat") ?? "");
  const lon = Number.parseFloat(request.nextUrl.searchParams.get("lon") ?? "");
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);

  const [kp, aircraft, launches] = await Promise.all([
    getCurrentKp(),
    hasCoords ? nearbyAircraft(lat, lon) : Promise.resolve(null),
    upcomingLaunches(),
  ]);

  return NextResponse.json({ kp, aircraft, launches });
}
