const mascotOptions = [
  {
    name: "Nox",
    type: "Pocket Owl",
    line: "You scored exactly chance today. Statistically immaculate.",
  },
  {
    name: "Iris",
    type: "Third-Eye Blob",
    line: "Day 47 of staring into the void.",
  },
  {
    name: "Aster",
    type: "Quiet Satellite",
    line: "The universe remains coy.",
  },
];

const mockups = [
  {
    title: "Mockup A · Phosphor",
    accent: "bg-[var(--accent-phosphor)]",
    accentLabel: "Soft phosphor green",
  },
  {
    title: "Mockup B · Amber",
    accent: "bg-[var(--accent-amber)]",
    accentLabel: "Warm amber",
  },
  {
    title: "Mockup C · Ice",
    accent: "bg-[var(--accent-ice)]",
    accentLabel: "Cool starlight blue",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="rounded-2xl border border-card-border bg-card/70 p-6 backdrop-blur">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          Project Primer
        </p>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">Third Eye</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted sm:text-base">
          Duolingo for psychic abilities: playful tone, server-authoritative drills,
          and honest statistics.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {mockups.map((mockup) => (
          <article
            key={mockup.title}
            className="rounded-2xl border border-card-border bg-card/80 p-4"
          >
            <div className={`mb-3 h-1.5 w-20 rounded-full ${mockup.accent}`} />
            <h2 className="text-base font-semibold">{mockup.title}</h2>
            <p className="mt-1 text-sm text-muted">{mockup.accentLabel}</p>
            <div className="mt-4 space-y-3 rounded-xl border border-card-border bg-black/20 p-3">
              <p className="font-mono text-xs text-muted">
                Today&apos;s drills · 3 min
              </p>
              <div className="h-2 rounded-full bg-white/10">
                <div className={`h-2 w-1/2 rounded-full ${mockup.accent}`} />
              </div>
              <p className="text-sm">Hit rate 26.1% · Chance 25%</p>
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-card-border bg-card/80 p-6">
        <h2 className="text-lg font-semibold">Mascot options</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {mascotOptions.map((option) => (
            <article
              key={option.name}
              className="rounded-xl border border-card-border bg-black/20 p-4"
            >
              <p className="text-sm font-semibold">{option.name}</p>
              <p className="text-xs text-muted">{option.type}</p>
              <p className="mt-2 text-sm text-muted">“{option.line}”</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
