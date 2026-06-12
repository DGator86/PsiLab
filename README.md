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
- **Server-authoritative card drill** (`/drill`): a 4-symbol Zener-style guess.
  The answer is chosen and committed server-side *before* the guess using
  commit-reveal hashing (`sha256(answer:salt)`); the client verifies the
  commitment after each reveal.
- **Honest statistics** (`/stats`): hit rate vs. 25% chance, Wilson 95% confidence
  interval, exact two-sided binomial test, and a 14-day hit-rate sparkline.
- **Daily loop** (`/`): 10-trial daily sessions, streaks with a streak freeze
  (one missed day forgiven, freeze earned back every 7-day streak milestone),
  XP events and levels.
- **Mascot**: Nox the Pocket Owl provides deadpan commentary.

## Deferred (schema is ready for them)

Remote-viewing sessions, focus sessions, field logs, billing, additional drill
types.
