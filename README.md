# NCWU CCCC Dashboard

华北水利水电大学天梯赛（GPLT）实时分数展示系统。从 PTA 拉取榜单，按天梯赛计分规则实时计算队伍/个人排名，提供官方风格观赛页与投屏大字版。

## 技术栈

- Next.js 16（App Router，全部页面为客户端组件）+ React 19 + Tailwind v4 + shadcn/ui
- 数据库：sql.js（SQLite 编译为 WASM），数据文件在 `data/dashboard.db`，无需额外数据库服务
- 数据来源：PTA 开放接口（需要比赛的 ID + Cookie）

## 快速开始

```bash
cp .env.example .env   # 然后修改 ADMIN_PASSWORD
npm install
npm run dev            # 开发模式，http://localhost:3000
```

生产：

```bash
npm run build
npm start              # 默认 3000 端口，可用 PORT=3000 指定
```

其他命令：`npm run lint`。

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `ADMIN_PASSWORD` | 是 | 后台管理密码。**必须设置**：缺失时 `next build` 会直接失败，运行时所有接口返回 500。修改后需重新 build 并重启。 |
| `COOKIE_SECURE` | 否 | 登录 Cookie 是否带 `Secure` 标记，默认 `true`。用 HTTPS 域名访问保持 `true`；若改用 `http://内网IP:端口` 直接访问，必须改成 `false`，否则浏览器会丢弃 Cookie，表现为"登录后又退回登录页"。 |

`.env` 已在 `.gitignore` 中，不会提交到仓库。

## 页面

| 路径 | 说明 | 是否需要登录 |
|---|---|---|
| `/` | 比赛列表（后台首页） | 是 |
| `/create` | 新建比赛（可粘贴 PTA ID + Cookie 自动拉取比赛信息，或 Excel 导入队伍） | 是 |
| `/competitions/[id]` | 比赛详情：队伍管理、成绩导入导出、PTA 同步状态、编辑 PTA 配置 | 是 |
| `/live/[id]/official` | 官方风格观赛页（队伍榜 / 个人榜） | 否 |
| `/live/[id]/projector` | 投屏大字版（倒计时、一血榜、通过率、自动滚动） | 是 |

只读类接口（`GET /api/...`）不校验登录，方便观赛页直接使用；写操作需要登录。

## 天梯赛计分规则

- 15 题：L1-1~L1-8（基础题，单题满分 5/5/10/10/15/15/20/20），L2-1~L2-4（进阶题，满分 25），L3-1~L3-3（登顶题，满分 30）
- 队伍：基础分 ≥ 800 解锁进阶题，进阶分 ≥ 400 解锁登顶题
- 队员：基础分 ≥ 80 解锁进阶题，进阶分 ≥ 40 解锁登顶题
- 阈值等常量定义在 `src/types/index.ts`

## PTA 数据同步

- 在新建比赛时填写 PTA 比赛 ID 与 Cookie，保存后自动同步（每 60 秒一次）；也可以在比赛详情页「编辑配置」里补充或更换 Cookie
- 同步会把 PTA 榜单按题目顺序映射到 L1-1 ~ L3-3，并按选手姓名匹配队伍名单（姓名需与 PTA 一致；名字不完全相同时会做包含匹配并计入"未匹配"）
- 比赛详情页会显示同步状态：运行中 / 未启用 / 失败原因、最后成功时间、匹配人数
- 服务重启后会自动恢复"进行中且有 PTA 配置"的比赛的同步（见 `src/instrumentation.ts`）
- PTA Cookie 有效期很短，失效后同步状态会显示 `PTA 认证失败，Cookie 可能已过期`，重新粘贴 Cookie 保存即可

## 部署注意

1. **必须单实例运行**（PM2 `instances=1`）。数据保存在 sql.js 内存中、每次变更整体重写 `data/dashboard.db`，多实例会互相覆盖数据。
2. **运行目录必须可写**，`data/dashboard.db` 会在首次启动时自动创建；`data/` 已在 `.gitignore` 中。
3. **服务器时区需为 `Asia/Shanghai`**。数据库时间使用 `datetime('now','localtime')`，比赛状态与倒计时按 `+08:00` 计算，UTC 会导致整体偏差 8 小时。
4. 构建（`npm run build`）需要至少 1.5G 可用内存，小内存机器建议先加 swap 或设置 `NODE_OPTIONS=--max-old-space-size=1536`。
5. **备份 `data/dashboard.db`** 即可备份全部比赛数据；比赛期间建议定期复制一份。
6. 更新代码流程：`git pull` → `npm install` → `npm run build` → 重启进程。

反向代理（Nginx/Caddy）指向 3000 端口即可；使用 HTTPS 时 `COOKIE_SECURE` 保持 `true`。

## 目录结构

```
src/app/api/            API 路由（Next Route Handlers，替代原 Express 服务）
src/app/live/[id]/      观赛页与大屏
src/lib/db.ts           sql.js 单例 + 建表 + 落盘
src/lib/score-calc.ts   天梯赛计分纯函数
src/lib/pta-scraper.ts  PTA 接口客户端
src/lib/pta-sync.ts     同步定时器与同步状态
src/lib/auth.ts         后台登录 Cookie 签名与校验
src/proxy.ts            登录鉴权中间件（Next 16 的 Proxy）
src/instrumentation.ts  启动时恢复 PTA 自动同步
src/styles/official.css 官方观赛页样式
```
