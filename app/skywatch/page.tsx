"use client";

import Link from "next/link";
import { useState } from "react";

const CHECKLIST = [
  { id: "flights", label: "Checked a flight tracker for aircraft in that direction" },
  { id: "satellites", label: "Checked satellite / Starlink pass times" },
  { id: "launches", label: "Checked for known rocket launches" },
  { id: "balloons", label: "Considered weather balloons and drones" },
  { id: "planets", label: "Ruled out Venus, Jupiter, and other bright planets" },
] as const;

const WEATHER = ["clear", "partly cloudy", "overcast", "hazy", "windy"] as const;
const DURATIONS = [15, 30, 60, 120] as const;

type Context = {
  kp: number | null;
  aircraft: { callsign: string; altitudeM: number | null; originCountry: string }[] | null;
  launches: { name: string; net: string; pad: string }[] | null;
};

export default function SkywatchPage() {
  const [location, setLocation] = useState("");
  const [weather, setWeather] = useState<string | null>(null);
  const [groupSize, setGroupSize] = useState(1);
  const [durationMin, setDurationMin] = useState<number>(30);
  const [notes, setNotes] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [anomalous, setAnomalous] = useState(false);
  const [context, setContext] = useState<Context | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ mascotLine: string; xpAwarded: number; anomalousFlag: boolean } | null>(null);

  const checklistComplete = CHECKLIST.every((c) => checks[c.id]);

  function loadContext() {
    setLoadingContext(true);
    const fetchIt = (coords?: { lat: number; lon: number }) => {
      const qs = coords ? `?lat=${coords.lat}&lon=${coords.lon}` : "";
      fetch(`/api/skywatch/context${qs}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => setContext(data))
        .finally(() => setLoadingContext(false));
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchIt({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => fetchIt(),
        { timeout: 5000 },
      );
    } else {
      fetchIt();
    }
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/skywatch/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, weather, groupSize, durationMin, notes, checklist: checks, anomalous }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Failed to log (${res.status})`);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            Sky watch · field log
          </p>
          <h1 className="mt-1 text-xl font-semibold">Eyes up, feet on the ground</h1>
        </div>
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Home
        </Link>
      </header>

      <p className="rounded-xl border border-amber-900/60 bg-amber-950/30 p-3 text-xs text-amber-200/80">
        House rule, non-negotiable: no lasers. Never point lasers at anything in the sky.
      </p>

      {error && (
        <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">{error}</div>
      )}

      {result ? (
        <section className="space-y-3 rounded-2xl border border-card-border bg-card/80 p-6">
          <p className="text-sm">
            Log filed{result.anomalousFlag ? " — flagged anomalous, post-checklist" : ""}.{" "}
            <span className="text-[var(--accent-phosphor)]">+{result.xpAwarded} XP</span>
          </p>
          <p className="text-sm text-muted">🦉 “{result.mascotLine}”</p>
          <Link href="/" className="inline-block text-sm text-[var(--accent-phosphor)] hover:underline">
            Back to the dashboard →
          </Link>
        </section>
      ) : (
        <>
          <section className="space-y-4 rounded-2xl border border-card-border bg-card/80 p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Reality check (live)</p>
              <button
                onClick={loadContext}
                disabled={loadingContext}
                className="rounded-xl border border-card-border px-3 py-1.5 text-xs text-muted transition hover:text-foreground disabled:opacity-40"
              >
                {loadingContext ? "Checking…" : "Check my sky"}
              </button>
            </div>
            {context ? (
              <div className="space-y-3 text-sm">
                <p>
                  <span className="text-muted">Geomagnetic Kp:</span>{" "}
                  <span className="font-mono">{context.kp ?? "unavailable"}</span>
                  {context.kp !== null && (
                    <span className="ml-2 text-xs text-muted">{context.kp < 3 ? "(quiet)" : context.kp < 5 ? "(unsettled)" : "(storm)"}</span>
                  )}
                </p>
                <div>
                  <p className="text-muted">Aircraft nearby (OpenSky):</p>
                  {context.aircraft === null ? (
                    <p className="text-xs text-muted">Unavailable — no location or the network is shy.</p>
                  ) : context.aircraft.length === 0 ? (
                    <p className="text-xs text-muted">None reported in a ~160 km box. Interesting start.</p>
                  ) : (
                    <ul className="mt-1 space-y-0.5 font-mono text-xs text-muted">
                      {context.aircraft.slice(0, 6).map((a, i) => (
                        <li key={i}>
                          {a.callsign} · {a.altitudeM ? `${a.altitudeM} m` : "alt n/a"} · {a.originCountry}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="text-muted">Upcoming launches (Launch Library):</p>
                  {context.launches === null ? (
                    <p className="text-xs text-muted">Unavailable right now.</p>
                  ) : (
                    <ul className="mt-1 space-y-0.5 text-xs text-muted">
                      {context.launches.map((l, i) => (
                        <li key={i}>
                          {l.name} — {l.net ? new Date(l.net).toLocaleString() : "TBD"}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">
                Pull live aircraft, launch, and geomagnetic data before you blame the unknown.
              </p>
            )}
          </section>

          <section className="space-y-4 rounded-2xl border border-card-border bg-card/80 p-6">
            <div>
              <label htmlFor="sw-location" className="text-xs uppercase tracking-wide text-muted">
                Location
              </label>
              <input
                id="sw-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={200}
                placeholder="Backyard, ridge trail, parking lot C…"
                className="mt-2 w-full rounded-xl border border-card-border bg-black/20 p-3 text-sm outline-none focus:border-[var(--accent-phosphor)]"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">Weather</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {WEATHER.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setWeather(weather === w ? null : w)}
                      aria-pressed={weather === w}
                      className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
                        weather === w
                          ? "border-[var(--accent-phosphor)] bg-[var(--accent-phosphor)]/15 text-[var(--accent-phosphor)]"
                          : "border-card-border text-muted hover:text-foreground"
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">Duration</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDurationMin(d)}
                      aria-pressed={durationMin === d}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        durationMin === d
                          ? "border-[var(--accent-phosphor)] bg-[var(--accent-phosphor)]/15 text-[var(--accent-phosphor)]"
                          : "border-card-border text-muted hover:text-foreground"
                      }`}
                    >
                      {d}m
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="sw-group" className="text-xs uppercase tracking-wide text-muted">
                  Group size
                </label>
                <input
                  id="sw-group"
                  type="number"
                  min={1}
                  max={99}
                  value={groupSize}
                  onChange={(e) => setGroupSize(Number(e.target.value))}
                  className="mt-2 w-20 rounded-xl border border-card-border bg-black/20 p-2 text-sm outline-none focus:border-[var(--accent-phosphor)]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="sw-notes" className="text-xs uppercase tracking-wide text-muted">
                Notes
              </label>
              <textarea
                id="sw-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={4000}
                placeholder="What you saw, headings, durations, brightness…"
                className="mt-2 w-full rounded-xl border border-card-border bg-black/20 p-3 text-sm outline-none focus:border-[var(--accent-phosphor)]"
              />
            </div>

            <div className="rounded-xl border border-card-border bg-black/20 p-4">
              <p className="text-sm font-semibold">Mundane checklist</p>
              <p className="mt-1 text-xs text-muted">
                The anomalous flag unlocks only after every box. This is the feature, not the
                friction.
              </p>
              <div className="mt-3 space-y-2">
                {CHECKLIST.map((item) => (
                  <label key={item.id} className="flex cursor-pointer items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox"
                      checked={!!checks[item.id]}
                      onChange={(e) => setChecks((c) => ({ ...c, [item.id]: e.target.checked }))}
                      className="accent-[var(--accent-phosphor)]"
                    />
                    {item.label}
                  </label>
                ))}
              </div>
              <label
                className={`mt-4 flex items-center gap-2 text-sm ${
                  checklistComplete ? "cursor-pointer text-foreground" : "cursor-not-allowed text-muted opacity-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={anomalous}
                  disabled={!checklistComplete}
                  onChange={(e) => setAnomalous(e.target.checked)}
                  className="accent-[var(--accent-phosphor)]"
                />
                Flag this session as anomalous
              </label>
            </div>

            <button
              onClick={() => void submit()}
              disabled={submitting || !location.trim()}
              className="rounded-xl bg-[var(--accent-phosphor)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
            >
              File field log
            </button>
          </section>
        </>
      )}
    </main>
  );
}
