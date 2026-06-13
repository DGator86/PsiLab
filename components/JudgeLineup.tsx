"use client";

import { useState } from "react";
import TargetImage from "@/components/TargetImage";

export type LineupItem = { id: string; imageUrl: string };

/**
 * Blind 1-of-4 rank judging UI: pick the candidate that best matches your
 * impressions. Forced choice at 25% chance.
 */
export default function JudgeLineup({
  lineup,
  onJudge,
  submitting,
}: {
  lineup: LineupItem[];
  onJudge: (pickId: string) => void;
  submitting: boolean;
}) {
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <div>
      <p className="text-sm text-muted">
        One of these four is your target; the other three are decoys. Compare each against your
        impressions and pick the best match. This is the part that counts — chance is exactly 25%.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {lineup.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPicked(item.id)}
            aria-pressed={picked === item.id}
            className={`overflow-hidden rounded-xl border-2 text-left transition ${
              picked === item.id
                ? "border-[var(--accent-phosphor)]"
                : "border-card-border hover:border-muted"
            }`}
          >
            <TargetImage imageUrl={item.imageUrl} alt={`Candidate ${i + 1}`} className="h-40 w-full object-cover" />
            <p className="px-3 py-2 font-mono text-xs text-muted">Candidate {String.fromCharCode(65 + i)}</p>
          </button>
        ))}
      </div>
      <button
        onClick={() => picked && onJudge(picked)}
        disabled={!picked || submitting}
        className="mt-4 rounded-xl bg-[var(--accent-phosphor)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
      >
        Lock my pick
      </button>
    </div>
  );
}
