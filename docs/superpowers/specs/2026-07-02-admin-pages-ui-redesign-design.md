# 管理页面 UI 改造 + 密码保护 — 设计文档

- **日期**: 2026-07-02
- **项目**: NCWU CCCC Dashboard (Next.js 16 + sql.js)
- **范围**: 3 个管理页面 UI 改造 + 全站管理密码保护
- **不影响**: live 投影页、API 业务逻辑、数据库、score-calc

---

## 1. 目标

把 3 个管理页面（首页/创建/详情）从"能用"提升为"专业、好用、有品牌感"，并加一层管理密码保护（GPLT 官方榜公开）。

**两层目标**：
- **UI 层**：消除误操作风险、提升信息密度、抽出复用组件、创建页向导化
- **安全层**：除 `/live/[id]/official` 外，所有路径（含 API）需管理密码

---

## 2. 范围之外（YAGNI）

- 不修改 live 投影页 UI（已重写）
- 不改 API 业务逻辑、数据库 schema、score-calc
- 不改 shadcn 组件源码
- 不加暗色模式优化（已有 next-themes）
- 不加权限/角色/审计日志
- 不加拖拽排序、批量操作
- 不做完整 i18n（保持 zh-CN）
- 不实现找回密码、密码修改 UI（密码在 `.env.local` 中改）

---

## 3. 新增文件清单

| 文件 | 用途 |
|---|---|
| `src/middleware.ts` | 路径白名单 + cookie 签名校验 |
| `src/lib/auth.ts` | 共享：cookie 签发/校验工具 |
| `src/app/login/page.tsx` | 极简密码登录页 |
| `src/app/api/auth/login/route.ts` | 校验密码 + Set-Cookie |
| `src/app/api/auth/logout/route.ts` | 清 cookie（保留备用，暂不挂 UI） |
| `src/components/simple/page-header.tsx` | 统一 sticky 头 |
| `src/components/simple/empty-state.tsx` | 空/错误状态组件 |
| `src/components/simple/confirm-dialog.tsx` | 通用确认弹窗 |
| `src/components/simple/status-badge.tsx` | 状态徽章 + 脉冲点 |
| `src/components/simple/team-form-dialog.tsx` | 合并 add/edit 队伍 |
| `src/components/simple/member-badges.tsx` | 选手 Badge 列表 + +N 折叠 |
| `.env.local`（gitignored） | `ADMIN_PASSWORD=xxx` |
| `.env.example`（提交到 git） | `ADMIN_PASSWORD=请设置管理密码`（需在 `.gitignore` 加 `!.env.example` 反忽略） |

---

## 4. 改造文件清单

| 文件 | 改动 |
|---|---|
| `src/app/page.tsx` | 用 PageHeader + StatusBadge + EmptyState + ConfirmDialog；卡片移除整卡点击 |
| `src/app/competitions/[id]/page.tsx` | 用 PageHeader；合并"大屏入口"+"操作"卡；表格用 MemberBadges + DropdownMenu；add/edit 用 TeamFormDialog；删除用 ConfirmDialog |
| `src/app/create/page.tsx` | 改为 Tabs 3 步；用 PageHeader + ConfirmDialog |

---

## 5. 认证设计

### 5.1 环境变量

```bash
# .env.local（gitignored）
ADMIN_PASSWORD=你的密码
```

```bash
# .env.example（提交到 git 提示）
ADMIN_PASSWORD=请设置管理密码
```

### 5.2 Cookie 设计

| 项 | 值 |
|---|---|
| 名称 | `admin_auth` |
| 值 | `hmac_sha256("admin-session-v1", ADMIN_PASSWORD)` 的 hex |
| HTTP-only | ✅ |
| SameSite | `Lax` |
| Secure | 仅生产环境 |
| maxAge | **不设** → session cookie（关浏览器失效） |

### 5.3 公开路径白名单

| 路径 | 原因 |
|---|---|
| `/login` | 登录页本身 |
| `/api/auth/login` | 登录 API |
| `/api/auth/logout` | 登出 API（备用） |
| `/_next/*` | 静态资源 |
| `/favicon.ico` | 图标 |
| `/live/<id>/official`（精确匹配） | GPLT 官方榜，大屏公开 |

正则：`/^\/live\/[^/]+\/official\/?$/`（末尾要求 `/` 或结尾，避免 `/official/extra` 也被豁免）

### 5.4 Middleware 行为

```
请求进入
  ├─ 路径在白名单？ → 放行
  ├─ 路径以 /api/ 开头 + 方法是 GET？ → 放行（数据获取类公开）
  ├─ 带有效 admin_auth cookie？ → 放行
  ├─ 路径以 /api/ 开头？ → 返回 401 JSON { error: "未授权" }
  └─ 页面路径？ → 重定向到 /login?from=<原路径>
```

### 5.5 启动检查

```ts
// src/lib/auth.ts 顶部
if (!process.env.ADMIN_PASSWORD) {
  throw new Error("ADMIN_PASSWORD 环境变量未设置");
}
```

### 5.6 改密码效果

由于签名密钥由 `ADMIN_PASSWORD` 派生，**改密码后所有现有 cookie 立即失效**，所有会话需重新登录。

### 5.7 登录页 UI（极简单色）

- 浅色背景，居中
- 标题："管理员登录"
- 单一密码 Input（type=password, autoFocus）
- 错误提示：密码错误时 Input 下方红字
- 按钮："登录" / "登录中..."
- 成功后 `router.push(from)`，from 默认为 `/`

---

## 6. 6 个新组件 API

### 6.1 `PageHeader`

```ts
interface PageHeaderProps {
  title: string;
  backHref?: string;
  actions?: React.ReactNode;
  className?: string;
}
```

- 内部: sticky 头 + 返回按钮（用 `useRouter` 跳转 backHref） + 标题（truncate flex-1） + 右侧 actions
- 三个页面 max-w 不同（6xl/3xl/5xl），通过 className 覆盖

### 6.2 `EmptyState`

```ts
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}
```

- 居中布局：图标 (text-muted-foreground) → 标题 → 描述 → 可选 CTA

### 6.3 `ConfirmDialog`

```ts
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;     // 默认"确认"
  cancelLabel?: string;      // 默认"取消"
  destructive?: boolean;     // 红色确认按钮
  onConfirm: () => void | Promise<void>;
}
```

- 基于 shadcn `<Dialog>`，`sm:max-w-md`
- 异步 onConfirm 时按钮显示 loading

### 6.4 `StatusBadge`

```ts
interface StatusBadgeProps {
  status: "active" | "upcoming" | "finished" | string;
  className?: string;
}
```

- active: 品牌色背景 + 绿色脉冲小圆点
- upcoming: 蓝色 outline
- finished: 灰色 secondary

### 6.5 `TeamFormDialog`

```ts
interface TeamFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  initialName?: string;
  initialMembers?: string;
  onSave: (data: { name: string; members: string }) => void | Promise<void>;
}
```

- 标题自适应："添加队伍" / "编辑队伍"
- 内部表单：name Input + members textarea (h-32)
- 校验：name 非空、members ≥ 1
- 异步 onSave 加 loading

### 6.6 `MemberBadges`

```ts
interface MemberBadgesProps {
  names: string[];
  maxVisible?: number;     // 默认 3
  className?: string;
}
```

- 前 N 个名字渲染为 `<Badge variant="secondary">`
- 超出显示 `+N` Badge，鼠标悬停用原生 `title` 属性展示全部名字
- **不**新增 shadcn Tooltip 组件（避免引入新依赖）

---

## 7. 页面改造详细说明

### 7.1 首页 `src/app/page.tsx`

- `<PageHeader title="..." actions={<Button>创建比赛</Button>} />` 替换手动 header
- 删除/结束 → `ConfirmDialog`
  - 删除描述：包含比赛名
  - 结束描述：说明结束后无法恢复活动状态
- 卡片移除整卡点击；hover 改 `hover:shadow-md`
- 卡片操作改 `<DropdownMenu>`（管理/结束/删除）
- 错误/空状态用 `<EmptyState>`：
  - 加载失败：icon=AlertCircle + 重试按钮
  - 无比赛：icon=Trophy + 创建按钮

### 7.2 详情页 `src/app/competitions/[id]/page.tsx`

- `<PageHeader title={detail.name} backHref="/" actions={...} />`
- "大屏入口" + "操作" 合并为单卡"快捷操作"，`<Separator>` 分组
- 同步按钮加 Loader2 图标
- 比赛信息卡右上角保留 `StatusBadge`（不实现编辑菜单）
- 队伍表格：
  - 选手列：`<MemberBadges maxVisible={3}>`
  - 操作列：`<DropdownMenu>`（编辑/删除）
  - 添加按钮：`<TeamFormDialog mode="add">`
- 编辑 dialog 改 `<TeamFormDialog mode="edit">`
- 删除确认：`<ConfirmDialog destructive>`
- 比赛不存在：`<EmptyState icon=TrophyOff>`

### 7.3 创建页 `src/app/create/page.tsx` — 3 步 Tabs

**顶部 stepper**：3 个圆点 + 连接线 + 文字（① PTA 信息 / ② 队伍与选手 / ③ 确认提交）

**Tab 1 — PTA 信息**
- ptaId、Cookie（含 show/hide）、获取按钮
- 校验：`ptaId` 与 `cookie` 非空 → fetch
- 成功填充 compName/startTime/duration
- Tab 1 完成后才能跳 Tab 2

**Tab 2 — 队伍与选手**
- 队伍列表（添加/删除/编辑）、Excel 导入
- 校验：至少 1 队，每队 name 非空、members ≥ 1
- Tab 2 完成后才能跳 Tab 3

**Tab 3 — 确认提交**
- 只读总览：比赛名称、开始时间、时长、PTA ID、队数/人数
- 底部"创建比赛"按钮
- 总览中每行可点击回到对应 Tab 修改

**导航**：每 Tab 底部"上一步" / "下一步"按钮，跨 Tab 修改后需重新验证。

---

## 8. 数据流

无 API 变更（除新增 `/api/auth/*`）：

| API | 用途 | 鉴权 |
|---|---|---|
| `GET /api/competitions` | 首页列表 / 公开读取 | 公开（GET 豁免） |
| `GET /api/competitions/[id]` | 详情页 / 官方榜 / 投屏 | 公开（GET 豁免） |
| `GET /api/competitions/[id]/sync-status` | 同步状态查询 | 公开（GET 豁免） |
| `POST /api/competitions` | 创建 | middleware 保护 |
| `PUT /api/competitions/[id]` | 队伍增删改 | middleware 保护 |
| `POST /api/competitions/[id]/sync-now` | 同步 | middleware 保护 |
| `POST /api/competitions/[id]/import-scores` | 导入分数 | middleware 保护 |
| `POST /api/competitions/[id]/scores` | 提交分数 | middleware 保护 |
| `POST /api/auth/login` | 登录 | 公开 |
| `POST /api/auth/logout` | 登出 | 公开 |
| `POST /api/pta/preview` | PTA 预览 | middleware 保护 |

**GET 全公开的安全前提**：所有 GET 路由都已剥离 `access_cookie` 等敏感字段（见 `src/app/api/competitions/route.ts:32-46`、`src/app/api/competitions/[id]/route.ts:103-116`）。

---

## 9. 错误处理

- 登录失败 → `setError("密码错误")` 红字
- 删除/结束/创建失败 → `ConfirmDialog` 弹错误条 / `setError` 错误条
- 加载失败 → `<EmptyState icon=AlertCircle>` + 重试
- 比赛不存在 → `<EmptyState icon=TrophyOff>` + 返回首页
- **移除所有** `window.confirm()` / `window.alert()`

---

## 10. 测试策略

- **不**新增自动化测试（项目无测试基础设施）
- **手动验收清单**：
  1. 未登录访问 `/` → 跳 `/login?from=/`
  2. 错误密码 → 提示"密码错误"
  3. 登录后跳回 from
  4. `/live/1/official` 公开
  5. `/live/1/projector` 受保护
  6. 关闭浏览器再访问 → 需重新登录
  7. 改 `.env.local` 密码 → 旧 cookie 失效
  8. 首页：空状态、加载 skeleton、删除/结束确认、卡片点击行为
  9. 详情页：合并 Card、同步 loading、表格操作
  10. 创建页：Tabs 步进、上一步/下一步、Tab 3 总览跳转
  11. StatusBadge：3 种状态颜色 + 脉冲点
  12. MemberBadges：≤3 人、>3 人、tooltip 内容
  13. 响应式：手机 (375px) / 平板 (768px) / 桌面 (1280px+)
- **构建验证**：`bun run build` 必须通过

---

## 11. 验收标准

- [ ] `bun run build` 通过，0 错误
- [ ] 所有 `window.confirm` / `window.alert` 移除
- [ ] 3 个页面共用 `<PageHeader>`
- [ ] StatusBadge 在 3 种状态下显示正确颜色 + 脉冲
- [ ] 选手列 ≤3 人全部显示，>3 人折叠为 `+N` + tooltip
- [ ] 创建页 3 步 Tabs 门控正确
- [ ] 详情页"大屏入口"与"操作"合并为单卡
- [ ] 删除比赛/结束比赛/删除队伍都有 `ConfirmDialog` 确认
- [ ] 空/错误状态用 `EmptyState` 组件
- [ ] 未登录访问受保护路径 → 跳 `/login?from=...`
- [ ] 登录成功 → 跳回 `from`
- [ ] `/live/[id]/official` 不需要密码
- [ ] API 路由受保护（无 cookie 返回 401）
- [ ] 关闭浏览器后 cookie 失效
- [ ] 改 `.env.local` 密码后旧 cookie 失效

---

## 12. 风险与缓解

| 风险 | 缓解 |
|---|---|
| Tabs 状态机卡死 | 暴露 `setTab` + 严格门控 + 顶部 stepper |
| 6+1 个新组件样式不统一 | 复用 shadcn 主题变量 |
| 输错密码无限制 | 接受（单管理员场景） |
| 改密码 = 全部会话失效 | 可接受（也是优点） |
| Middleware 性能 | 路径白名单短路 + HMAC 很快 |
| API 401 客户端未处理 | fetch 失败时 alert 或跳 login |
| `ADMIN_PASSWORD` 未设置 | 启动时抛错强制配置 |
| middleware 读取 env 的时机 | Next.js middleware 编译时注入，build/start 时校验 |

---

## 13. 实施顺序

### Phase 1 — 认证基础（独立）
1. `.gitignore` 加 `!.env.example`（`.env*` 已被忽略，反忽略示例文件）
2. `.env.example` + `.env.local`
3. `src/lib/auth.ts`（含启动检查）
4. `src/middleware.ts`
5. `src/app/api/auth/login/route.ts`
6. `src/app/api/auth/logout/route.ts`
7. `src/app/login/page.tsx`
8. **构建验证**

### Phase 2 — 6 个新组件（按依赖顺序）
1. `EmptyState`（无依赖）
2. `StatusBadge`（无依赖）
3. `MemberBadges`（用原生 `title` 属性，无新依赖）
4. `ConfirmDialog`（依赖 shadcn Dialog）
5. `TeamFormDialog`（依赖 ConfirmDialog 风格的 Input/Textarea）
6. `PageHeader`（无依赖）
7. **构建验证**

### Phase 3 — 3 个页面改造
1. 详情页 `competitions/[id]/page.tsx`
2. 首页 `page.tsx`
3. 创建页 `create/page.tsx`
4. **每步 `bun run build`**

### Phase 4 — 手动验收
- 13 项验收清单全部通过

---

## 14. 备选方案（不采用，仅记录）

- **方案 A**：完全重写管理页为单页 Dashboard + 侧边栏
  - 否决：scope 过大，破坏现有 URL 结构
- **方案 B**：使用第三方组件库（Ant Design Pro Form）
  - 否决：与 shadcn 主题冲突
- **方案 C**：删除详情页，比赛管理直接在首页 inline
  - 否决：详情页功能太多，挤在首页会爆炸
- **方案 D**：用独立 secret 签名 cookie（`AUTH_SECRET`）
  - 否决：用户选择"密钥从密码派生"简化方案
- **方案 E**：用 JWT 替代 HMAC
  - 否决：HMAC 已足够，JWT 引入额外依赖
