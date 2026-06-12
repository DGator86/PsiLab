# PsiLab · Third Eye (working title)

A playful daily-practice app that tests intuition drills with honest statistics.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Neon Postgres + Drizzle ORM

## Getting started

1. Create a [Neon](https://neon.tech) Postgres database.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`.
3. Install and migrate:

```bash
npm install
npm run db:migrate
npm run dev
```

## Available scripts

```bash
npm run dev          # start the dev server
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run build        # production build
npm run db:generate  # generate SQL migrations from db/schema.ts
npm run db:migrate   # apply migrations to DATABASE_URL
npm run db:studio    # browse the database
```

## What's implemented

- **Anonymous identity**: a middleware-assigned cookie id; user rows are created on
  first contact (`lib/auth.ts`). Designed to be swapped for a real auth provider
  (e.g. Clerk) later — everything downstream only depends on the user id.
- **Server-authoritative quick-fire drills** (`/drill`): 4-symbol Zener-style
  guess (chance 25%) and red/black card call (chance 50%). The answer is chosen
  and committed server-side *before* the guess using commit-reveal hashing
  (`sha256(answer:salt)`); the client verifies the commitment after each reveal.
- **Calibration XP**: a Brier-based proper scoring rule rewards honest
  confidence ratings — the one genuinely trainable skill.
- **Remote viewing daily target** (`/rv`): one hidden target a day from a seeded
  pool of tagged public-domain images (`npm run db:seed`); structured
  impressions lock before the one-way reveal, followed by a subjective
  self-score rubric kept separate from forced-choice stats.
- **Focus training** (`/focus`): 5/10/20-minute timer with generic level names
  (Body Calm, Expanded Awareness, Open Field) and a post-session journal.
- **Honest statistics** (`/stats`): per-drill hit rate vs. its chance baseline,
  Wilson 95% confidence interval, exact two-sided binomial test, calibration
  curve + score, time-of-day breakdown, 14-day sparklines, and sample-size
  caveats under 100 trials.
- **Daily loop** (`/`): 10-trial daily sessions, streaks with a streak freeze
  (one missed day forgiven, freeze earned back every 7-day streak milestone),
  XP events and primer level titles (Novice → Sensitive → Calibrated →
  Statistically Anomalous → Immaculate).
- **Mascot**: Nox the Pocket Owl provides deadpan commentary.

## Deferred (schema is ready for them)

Sky Watch field logs, billing, sketch pad for RV sessions, ambient audio for
focus sessions.
