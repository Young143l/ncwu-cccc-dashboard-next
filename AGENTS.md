# NCWU CCCC Dashboard — AGENTS.md

## Quick start

```bash
cp .env.example .env   # 必做：填 ADMIN_PASSWORD，缺失会导致 build 失败
npm install
npm run dev            # Next.js dev server at localhost:3000
npm run build          # Production build (TypeScript check + Next compile)
npm run start          # Production serve
npm run lint           # ESLint
```

No separate backend — API routes are built into Next.js (App Router).

部署约束：必须单实例（sql.js 内存库 + 整文件重写，多实例互相覆盖）、运行目录可写（`data/dashboard.db`）、服务器时区 `Asia/Shanghai`。

## Architecture

```
src/app/api/competitions/   ← Express replacement (Route Handlers)
src/app/live/[id]/official  ← GPLT official style (progress pipes + space theme)
src/app/live/[id]/projector ← Big-screen projector (first blood, pass rate, auto-scroll)
src/lib/db.ts               ← SQL.js singleton (in-memory + file persistence at data/dashboard.db)
src/lib/score-calc.ts       ← GPLT scoring pure functions (threshold logic)
src/lib/pta-scraper.ts      ← PTA API client (fetch scores)
src/lib/pta-sync.ts         ← Sync timer manager + sync status (per competition)
src/lib/auth.ts             ← Admin cookie HMAC sign/verify
src/proxy.ts                ← Auth gate (Next 16 Proxy, Node runtime)
src/instrumentation.ts      ← Restore PTA auto-sync on server boot
src/types/index.ts          ← GPLT constants (thresholds, problem labels)
src/context/score-context.tsx ← Client state useReducer
src/styles/official.css     ← 1:1 copy of PTA official GPLT CSS
```

## Environment variables

| Var | Required | Note |
|---|---|---|
| `ADMIN_PASSWORD` | yes | Missing => `next build` fails, runtime 500s |
| `COOKIE_SECURE` | no | default `true`; set `false` when serving over plain HTTP |

## GPLT scoring rules

- 15 problems: L1-1~8 (basic, max 5/5/10/10/15/15/20/20), L2-1~4 (advanced, max 25/ea), L3-1~3 (top, max 30/ea)
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
- DB file at `data/dashboard.db` (gitignored); schema + `PRAGMA foreign_keys = ON` are applied in `getDb()` on every cold start
- No demo/seed data — a fresh DB is empty by design

## Known quirks

- 客户端组件（`live/[id]/official`、`competitions/[id]`、`embedded-rank`）会 import `lib/server-utils.ts`，该文件必须是纯函数，**绝不能**引入 `lib/db.ts`（会把 `fs`/`sql.js` 打进浏览器包，`next build` 直接报 `Can't resolve 'fs'`）
- Competition status is computed dynamically from `start_time + duration_minutes` (`lib/competition-status.ts`)，DB `status` 列只是兜底；改 `status` 不影响列表显示
- 所有写 scores 的地方都用 UPSERT（`ON CONFLICT(member_id, problem_label) DO UPDATE`），不要改回 `INSERT OR REPLACE`，否则会把 `accept_time`（一血榜数据）清零
- PTA 同步：`syncOnce` 有 `syncInProgress` 并发锁；状态（最后尝试/成功时间、失败原因、匹配人数）存内存 `syncStates`，通过 `GET /api/competitions/[id]/sync-status` 暴露，重启后由 `src/instrumentation.ts` 恢复定时器
- 自动同步只在「有 cookie + 有 pta_contest_id + 状态为 active」时启动；每 60 秒一次
- 只有比赛名、PTA ID/Cookie、开始时间、时长、队伍经 PUT 更新；改 cookie 或 PTA ID 会重启该比赛的同步定时器
- 登录 Cookie 的 `Secure` 标记由 `COOKIE_SECURE` 控制（默认 true），纯 HTTP 访问必须置 false，否则登录死循环
- `GET /api/**` 在 `src/proxy.ts` 里全部免登录（观赛页需要），写操作才校验 Cookie
- Official GPLT pipe images require inline CSS variables on `rankTeamPage_KSGze` / `rankStudentPage_YXwTc`
- `useScoreAnimation` tracks a single numeric dep — separate team and member animations don't coordinate
- All `'use client'` — no server components used in pages (real-time nature)
- Chinese locale (`zh-CN`), Microsoft YaHei font family

## shadcn/ui

- Tailwind v4 + CSS variables in `globals.css`
- 4 themes: light/dark/emerald/violet, switched via class on `<html>`
- Brand color: huashui-blue (#004098)
- Components under `components/ui/` (installed via shadcn CLI)

## Excel import

- `src/lib/excel-utils.ts` — parses column A=team name, B+=member names
- `downloadTeamTemplate` is client-side only (uses `XLSX.writeFile`)
