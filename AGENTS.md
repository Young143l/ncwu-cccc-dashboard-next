# NCWU CCCC Dashboard — AGENTS.md

## Quick start

```bash
bun run dev        # Next.js dev server at localhost:3000
bun run build      # Production build (TypeScript check + Next compile)
bun run start      # Production serve
bun run lint       # ESLint
```

No separate backend — API routes are built into Next.js (App Router).

## Architecture

```
app/api/competitions/   ← Express replacement (Route Handlers)
app/live/[id]/official  ← GPLT official style (progress pipes + space theme)
app/live/[id]/projector ← Big-screen projector (first blood, pass rate, auto-scroll)
lib/db.ts               ← SQL.js singleton (in-memory + file persistence at data/dashboard.db)
lib/score-calc.ts       ← GPLT scoring pure functions (threshold logic)
lib/pta-scraper.ts      ← PTA API client (fetch scores)
lib/pta-sync.ts         ← Sync timer manager (setInterval per competition)
types/index.ts          ← GPLT constants (thresholds, problem labels)
context/score-context.tsx ← Client state useReducer
styles/official.css     ← 1:1 copy of PTA official GPLT CSS (879 lines)
```

## GPLT scoring rules

- 15 problems: L1-1~8 (basic, max 100/ea), L2-1~4 (advanced, max 25/ea), L3-1~3 (top, max 30/ea)
- Team: basic >= 800 unlocks advanced; advanced >= 400 unlocks top
- Member: basic >= 80 unlocks advanced; advanced >= 40 unlocks top
- Thresholds defined in `types/index.ts`

## PTA scraper

Two API endpoints (must send `Accept: application/json` + `Cookie` header):

| Endpoint | Use |
|---|---|
| `GET /api/problem-sets/{id}/exam-problem-types` | Problem list with labels |
| `GET /api/problem-sets/{id}/common-rankings?page=N&limit=50` | Rankings with scores |

`transformPtaData` maps PTA problems to GPLT labels **by position** (first 8 → basic, next 4 → advanced, last 3 → top), not by label name. `studentUserById` has real names; `userById` has nicknames.

## Database schema

```sql
competitions (id, name, created_at, status, start_time, duration_minutes, access_cookie, pta_contest_id)
teams (id, competition_id, name)
members (id, team_id, name)
scores (id, member_id, problem_label, score, max_score, accept_time, valid_submit_count, updated_at)
```

- Score labels: `"L1-1"` to `"L3-3"` (15 total)
- DB auto-seeded once on first GET `/api/competitions` (checked via `PRAGMA user_version`)
- DB file at `data/dashboard.db` (gitignored)

## Known quirks

- `PRAGMA foreign_keys = ON` must be set every connection — currently missing, cascade deletes don't work
- `seed.ts` hardcodes `L1-N` labels instead of using `PROBLEM_LABELS` — seed data has wrong labels
- Team editing via PUT endpoint is broken — only handles `status`, not team data
- `scores` POST resets `max_score` to 0 (INSERT OR REPLACE omits it)
- PTA sync has no concurrency lock — multiple runs can collide
- Official GPLT pipe images require inline CSS variables on `rankTeamPage_KSGze` / `rankStudentPage_YXwTc`
- Competition status is computed dynamically from `start_time + duration_minutes`, not from DB `status` column
- First blood in projector hardcodes `acceptTime = 0` — actual data not tracked through pipeline
- `useScoreAnimation` tracks a single numeric dep — separate team and member animations don't coordinate
- All `'use client'` — no server components used in pages (real-time nature)
- Chinese locale (`zh-CN`), Microsoft YaHei font family

## shadcn/ui

- Tailwind v4 + CSS variables in `globals.css`
- 4 themes: light/dark/emerald/violet, switched via class on `<html>`
- Brand color: huashui-blue (#004098)
- Components under `components/ui/` (installed via shadcn CLI)

## Excel import

- `lib/excel-utils.ts` — parses column A=team name, B+=member names
- `downloadTeamTemplate` is client-side only (uses `XLSX.writeFile`)
