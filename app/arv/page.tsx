"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import TargetImage from "@/components/TargetImage";

type TargetRef = { id: string; imageUrl: string } | null;

type Revealed = {
  createdDate: string;
  outcome: string;
  commitSalt: string;
  commitHash: string;
  choice: string | null;
  correct: boolean | null;
  targetA: TargetRef;
  targetB: TargetRef;
  xpAwarded: number;
};

type TodayState = {
  state: "pending" | "choosing" | "locked";
  commitHash?: string;
  revealDate?: string;
  choice?: string | null;
  targetA?: TargetRef;
  targetB?: TargetRef;
  revealed?: Revealed | null;
};

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function ArvPage() {
  const [today, setToday] = useState<TodayState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [picked, setPicked] = useState<"A" | "B" | null>(null);
  const [impressions, setImpressions] = useState("");
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/arv/today")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        return res.json();
      })
      .then((data: TodayState) => {
        setToday(data);
        if (data.revealed) {
          void sha256Hex(`${data.revealed.outcome}:${data.revealed.commitSalt}`).then((h) =>
            setVerified(h === data.revealed!.commitHash),
          );
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Something went wrong"));
  }, []);

  async function start() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/arv/start", { method: "POST" });
      if (!res.ok) throw new Error(`Failed to start (${res.status})`);
      const data = await res.json();
      setToday((prev) => ({ ...prev, ...data, revealed: prev?.revealed ?? null }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function lockChoice() {
    if (submitting || !picked) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/arv/choose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice: picked, impressionsText: impressions }),
      });
      if (!res.ok) throw new Error(`Failed to lock (${res.status})`);
      const data = await res.json();
      setToday((prev) => (prev ? { ...prev, state: "locked", choice: data.choice } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const r = today?.revealed;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            Associative remote viewing
          </p>
          <h1 className="mt-1 text-xl font-semibold">Tomorrow&apos;s coin flip</h1>
        </div>
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Home
        </Link>
      </header>

      {error && (
        <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">{error}</div>
      )}

      {!today && !error && (
        <div className="h-64 animate-pulse rounded-2xl border border-card-border bg-card/50" />
      )}

      {r && (
        <section className="space-y-3 rounded-2xl border border-card-border bg-card/80 p-6">
          <p className="text-xs uppercase tracking-wide text-muted">
            Reveal · prediction from {r.createdDate}
          </p>
          <p className="text-sm">
            The coin was <span className="font-mono font-semibold uppercase">{r.outcome}</span>
            {r.choice
              ? r.correct
                ? " — and you picked the matching target. A hit at 50% chance."
                : " — your pick was bound to the other side. A miss."
              : " — but you never locked a choice, so nothing counts."}
            {r.correct && <span className="ml-2 text-[var(--accent-phosphor)]">+{r.xpAwarded} XP</span>}
          </p>
          <p className="font-mono text-[11px] text-muted">
            commitment {verified === null ? "checking…" : verified ? "verified ✓" : "MISMATCH ✗"} ·{" "}
            sha256(outcome:salt) = {r.commitHash.slice(0, 16)}…
          </p>
        </section>
      )}

      {today?.state === "pending" && (
        <section className="space-y-4 rounded-2xl border border-card-border bg-card/80 p-6">
          <p className="text-sm text-muted">
            The protocol: the server flips a coin <em>right now</em> and seals it (you get the
            hash). Two photos are bound to the outcomes. Tomorrow you&apos;ll be shown the photo
            matching the flip — so today, perceive <em>the photo you will see tomorrow</em> and
            pick it. Precognition, with receipts.
          </p>
          <button
            onClick={() => void start()}
            disabled={submitting}
            className="rounded-xl bg-[var(--accent-phosphor)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
          >
            Flip &amp; seal the coin
          </button>
        </section>
      )}

      {today?.state === "choosing" && today.targetA && today.targetB && (
        <section className="space-y-4 rounded-2xl border border-card-border bg-card/80 p-6">
          <p className="font-mono text-[11px] text-muted">
            sealed commitment: {today.commitHash?.slice(0, 24)}… · reveals {today.revealDate}
          </p>
          <p className="text-sm text-muted">
            Which of these will you be shown tomorrow? Sit with it, then lock your pick.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {([["A", today.targetA], ["B", today.targetB]] as const).map(([label, target]) => (
              <button
                key={label}
                type="button"
                onClick={() => setPicked(label)}
                aria-pressed={picked === label}
                className={`overflow-hidden rounded-xl border-2 text-left transition ${
                  picked === label ? "border-[var(--accent-phosphor)]" : "border-card-border hover:border-muted"
                }`}
              >
                <TargetImage imageUrl={target!.imageUrl} alt={`Option ${label}`} className="h-44 w-full object-cover" />
                <p className="px-3 py-2 font-mono text-xs text-muted">Option {label}</p>
              </button>
            ))}
          </div>
          <input
            value={impressions}
            onChange={(e) => setImpressions(e.target.value)}
            maxLength={1000}
            placeholder="Optional: what did you perceive?"
            className="w-full rounded-xl border border-card-border bg-black/20 p-3 text-sm outline-none focus:border-[var(--accent-phosphor)]"
          />
          <button
            onClick={() => void lockChoice()}
            disabled={!picked || submitting}
            className="rounded-xl bg-[var(--accent-phosphor)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
          >
            Lock prediction
          </button>
        </section>
      )}

      {today?.state === "locked" && (
        <section className="space-y-3 rounded-2xl border border-card-border bg-card/80 p-6">
          <p className="text-sm">
            Prediction locked: <span className="font-mono font-semibold">Option {today.choice}</span>
          </p>
          <p className="text-sm text-muted">
            The coin stays sealed until {today.revealDate} (UTC). Come back tomorrow — the reveal
            happens on your first visit. 🦉 “The future appreciates your patience. Probably.”
          </p>
          <p className="font-mono text-[11px] text-muted">
            commitment: {today.commitHash?.slice(0, 24)}…
          </p>
        </section>
      )}
    </main>
  );
}
