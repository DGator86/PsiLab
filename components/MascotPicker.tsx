"use client";

import { useState } from "react";

const MASCOTS = [
  { id: "nox", name: "Nox", type: "Pocket Owl", emoji: "🦉", pro: false },
  { id: "iris", name: "Iris", type: "Third-Eye Blob", emoji: "👁️", pro: true },
  { id: "aster", name: "Aster", type: "Quiet Satellite", emoji: "🛰️", pro: true },
];

export default function MascotPicker({
  current,
  plan,
}: {
  current: string;
  plan: string;
}) {
  const [selected, setSelected] = useState(current);
  const [error, setError] = useState<string | null>(null);

  async function pick(id: string) {
    setError(null);
    const res = await fetch("/api/settings/mascot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mascot: id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error ?? "Couldn't switch mascot");
      return;
    }
    setSelected(id);
  }

  return (
    <div>
      <div className="flex gap-2">
        {MASCOTS.map((m) => {
          const locked = m.pro && plan === "free";
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => void pick(m.id)}
              aria-pressed={selected === m.id}
              title={locked ? `${m.name} (${m.type}) — Pro pack` : `${m.name} (${m.type})`}
              className={`relative rounded-xl border px-3 py-2 text-xl transition ${
                selected === m.id
                  ? "border-[var(--accent-phosphor)] bg-[var(--accent-phosphor)]/10"
                  : "border-card-border hover:border-muted"
              } ${locked ? "opacity-50" : ""}`}
            >
              {m.emoji}
              {locked && <span className="absolute -right-1 -top-1 text-[10px]">🔒</span>}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-xs text-amber-300/80">{error}</p>}
    </div>
  );
}
