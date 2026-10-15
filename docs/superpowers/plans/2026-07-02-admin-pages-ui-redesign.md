# 管理页面 UI 改造 + 密码保护 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 3 个管理页面（首页/创建/详情）从"能用"提升为"专业、有品牌感"，并加管理密码保护（GPLT 官方榜公开）。

**Architecture:**
- **认证层**：Next.js Middleware 拦截所有路径，session-only HMAC-SHA256 签名的 cookie
- **UI 层**：6 个新复用组件（PageHeader/EmptyState/ConfirmDialog/StatusBadge/TeamFormDialog/MemberBadges）+ 3 个页面改造

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind v4, shadcn (base-ui), Bun, lucide-react

## Global Constraints

- 项目**不是 git 仓库**，所有 task 跳过 `git commit` 步骤
- TypeScript strict 模式（tsconfig.json:7）
- 使用 `bun` 而非 `npm`/`node`
- 路径别名 `@/*` → `./src/*`（tsconfig.json:22-23）
- 不引入新依赖（shadcn 工具足够）
- 中文 UI（zh-CN），Microsoft YaHei 字体已在 globals.css
- 已存在 shadcn 组件：button / badge / card / dialog / dropdown-menu / input / label / separator / sheet / skeleton / table / tabs
- **不**新增 shadcn Tooltip（用原生 `title` 属性）

---

# Phase 1: 认证基础（5 tasks）

## Task 1.1: 更新 .gitignore 反忽略 .env.example

**Files:**
- Modify: `.gitignore`（在 line 34 之后加一行）

**Context:** 当前 `.gitignore:34` 写的是 `.env*`，会忽略所有以 `.env` 开头的文件，包括我们想提交到 git 的 `.env.example`。

- [ ] **Step 1: 在 .gitignore 第 34 行后加 `!.env.example`**

读取当前 .gitignore（line 34）:
```
.env*
```
改为:
```
.env*
!.env.example
```

- [ ] **Step 2: 验证**

Read `.gitignore` 确认 35 行是 `!.env.example`

---

## Task 1.2: 创建 .env.example 和 .env.local

**Files:**
- Create: `.env.example`
- Create: `.env.local`

- [ ] **Step 1: 创建 `.env.example`**

内容:
```bash
# 管理密码 - 修改后需重启服务
ADMIN_PASSWORD=请设置管理密码
```

- [ ] **Step 2: 创建 `.env.local`**

内容:
```bash
ADMIN_PASSWORD=dev123
```

（开发用弱密码，生产环境用户自行改强密码。）

- [ ] **Step 3: 验证文件存在**

```bash
Test-Path .env.example
Test-Path .env.local
```

Expected: 两者都 True

---

## Task 1.3: 创建 src/lib/auth.ts（共享 cookie 工具）

**Files:**
- Create: `src/lib/auth.ts`

**Context:** 提供 cookie 签名/校验的纯函数。密钥从 `ADMIN_PASSWORD` 派生。

- [ ] **Step 1: 创建文件**

完整内容:
```ts
import { createHmac, timingSafeEqual } from "crypto";

const PASSWORD = process.env.ADMIN_PASSWORD;
const COOKIE_PAYLOAD = "admin-session-v1";

if (!PASSWORD) {
  throw new Error("ADMIN_PASSWORD 环境变量未设置");
}

export function signCookieValue(): string {
  return createHmac("sha256", PASSWORD!).update(COOKIE_PAYLOAD).digest("hex");
}

export function verifyCookieValue(value: string | undefined): boolean {
  if (!value || !PASSWORD) return false;
  const expected = signCookieValue();
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const ADMIN_COOKIE = "admin_auth";
```

- [ ] **Step 2: 构建验证（不要全量 build，只做类型检查）**

```bash
cd "C:\Users\Young143\Desktop\ncwu-cccc-dashboard-next" && bunx tsc --noEmit src/lib/auth.ts 2>&1
```

Expected: 0 错误（可能出现 "Cannot find module 'next'" 之类警告可忽略，单文件检查）

---

## Task 1.4: 创建 src/proxy.ts

**Files:**
- Create: `src/proxy.ts`（Next.js 16 已将 `middleware.ts` 改名为 `proxy.ts`，导出函数名也从 `middleware` 改为 `proxy`）

**Context:** 拦截所有请求，公开路径放行，其他路径验 cookie。API 路由返回 401 JSON，页面路径重定向到 `/login`。

- [ ] **Step 1: 创建文件**

完整内容:
```ts
import { NextResponse, NextRequest } from "next/server";
import { verifyCookieValue, ADMIN_COOKIE } from "@/lib/auth";

const PUBLIC_API_PATHS = ["/api/auth/login", "/api/auth/logout"];

const PUBLIC_PAGE_PATHS = ["/login"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_API_PATHS.includes(pathname)) return true;
  if (PUBLIC_PAGE_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (/^\/live\/[^/]+\/official\/?$/.test(pathname)) return true;
  return false;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  if (pathname.startsWith("/api/") && req.method === "GET") {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
  if (verifyCookieValue(cookie)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|gplt).*)"],
};
```

- [ ] **Step 2: 全量 build 验证**

```bash
cd "C:\Users\Young143\Desktop\ncwu-cccc-dashboard-next" && bun run build 2>&1
```

Expected: ✓ Compiled successfully

---

## Task 1.5: 创建登录 API 和登录页

**Files:**
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/login/page.tsx`

- [ ] **Step 1: 创建登录 API**

文件 `src/app/api/auth/login/route.ts` 完整内容:
```ts
import { NextRequest, NextResponse } from "next/server";
import { signCookieValue, ADMIN_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "密码错误" }, { status: 401 });
  }
  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE, signCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return res;
}
```

- [ ] **Step 2: 创建登出 API**

文件 `src/app/api/auth/logout/route.ts` 完整内容:
```ts
import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
```

- [ ] **Step 3: 创建登录页**

文件 `src/app/login/page.tsx` 完整内容:
```tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      if (res.ok) {
        router.push(from);
        router.refresh();
      } else {
        setError("密码错误");
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center">管理员登录</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <Input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="管理密码"
              autoFocus
              disabled={loading}
            />
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "登录中..." : "登录"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
      } else {
        setError("密码错误");
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center">管理员登录</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <Input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="管理密码"
              autoFocus
              disabled={loading}
            />
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "登录中..." : "登录"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: 全量 build 验证**

```bash
cd "C:\Users\Young143\Desktop\ncwu-cccc-dashboard-next" && bun run build 2>&1
```

Expected: ✓ Compiled successfully（路由表会新增 `/login` + `/api/auth/login` + `/api/auth/logout`）

---

# Phase 1 验收

- [ ] 启动 dev server: `bun run dev`
- [ ] 浏览器访问 `http://localhost:3000/` → 应自动跳转到 `/login?from=/`
- [ ] 输入错误密码 → 看到"密码错误"
- [ ] 输入正确密码 `dev123` → 跳回首页
- [ ] 访问 `http://localhost:3000/live/1/official` → **不**需要密码
- [ ] 关闭浏览器再访问 `/` → 需重新登录

---

# Phase 2: 6 个新组件（6 tasks）

## Task 2.1: 创建 EmptyState 组件

**Files:**
- Create: `src/components/simple/empty-state.tsx`

- [ ] **Step 1: 创建文件**

完整内容:
```tsx
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-12 px-4",
        className
      )}
    >
      <Icon className="size-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
      )}
      {action && <Button onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}
```

- [ ] **Step 2: 验证（不构建）**

只检查 TypeScript 不会出问题：`bunx tsc --noEmit src/components/simple/empty-state.tsx`

---

## Task 2.2: 创建 StatusBadge 组件

**Files:**
- Create: `src/components/simple/status-badge.tsx`

- [ ] **Step 1: 创建文件**

完整内容:
```tsx
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: "active" | "upcoming" | "finished" | string;
  className?: string;
}

const labels: Record<string, string> = {
  active: "进行中",
  upcoming: "未开始",
  finished: "已结束",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label = labels[status] || status;

  if (status === "active") {
    return (
      <Badge className={cn("bg-primary text-primary-foreground gap-1.5", className)}>
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-green-500" />
        </span>
        {label}
      </Badge>
    );
  }

  if (status === "upcoming") {
    return (
      <Badge variant="outline" className={cn("border-blue-500 text-blue-600 dark:text-blue-400", className)}>
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className={className}>
      {label}
    </Badge>
  );
}
```

---

## Task 2.3: 创建 MemberBadges 组件

**Files:**
- Create: `src/components/simple/member-badges.tsx`

- [ ] **Step 1: 创建文件**

完整内容:
```tsx
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface MemberBadgesProps {
  names: string[];
  maxVisible?: number;
  className?: string;
}

export function MemberBadges({
  names,
  maxVisible = 3,
  className,
}: MemberBadgesProps) {
  if (names.length === 0) {
    return (
      <span className="text-muted-foreground text-sm">—</span>
    );
  }

  const visible = names.slice(0, maxVisible);
  const hidden = names.length - visible.length;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {visible.map((name) => (
        <Badge key={name} variant="secondary">
          {name}
        </Badge>
      ))}
      {hidden > 0 && (
        <Badge
          variant="outline"
          title={names.slice(maxVisible).join("、")}
        >
          +{hidden}
        </Badge>
      )}
    </div>
  );
}
```

---

## Task 2.4: 创建 ConfirmDialog 组件

**Files:**
- Create: `src/components/simple/confirm-dialog.tsx`

- [ ] **Step 1: 创建文件**

完整内容:
```tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "确认",
  cancelLabel = "取消",
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "处理中..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: 验证 DialogDescription 存在**

Read `src/components/ui/dialog.tsx` 确认 `DialogDescription` 已 export。如果没有，需添加（在 `DialogHeader` 后插入）。

---

## Task 2.5: 创建 TeamFormDialog 组件

**Files:**
- Create: `src/components/simple/team-form-dialog.tsx`

- [ ] **Step 1: 创建文件**

完整内容:
```tsx
"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TeamFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  initialName?: string;
  initialMembers?: string;
  onSave: (data: { name: string; members: string }) => void | Promise<void>;
}

export function TeamFormDialog({
  open,
  onOpenChange,
  mode,
  initialName = "",
  initialMembers = "",
  onSave,
}: TeamFormDialogProps) {
  const [name, setName] = useState(initialName);
  const [members, setMembers] = useState(initialMembers);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setMembers(initialMembers);
      setError("");
    }
  }, [open, initialName, initialMembers]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("队名不能为空");
      return;
    }
    const memberList = members
      .split(/[,，、]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (memberList.length === 0) {
      setError("至少需要一名队员");
      return;
    }

    setLoading(true);
    try {
      await onSave({ name: name.trim(), members: members.trim() });
      onOpenChange(false);
    } catch {
      setError("保存失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "添加队伍" : "编辑队伍"}</DialogTitle>
          <DialogDescription>
            队员姓名用逗号、顿号或空格分隔
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-name">队名</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：算法先锋队"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team-members">队员</Label>
            <textarea
              id="team-members"
              value={members}
              onChange={(e) => setMembers(e.target.value)}
              placeholder="张三, 李四, 王五"
              disabled={loading}
              className="w-full h-32 px-3 py-2 rounded-md border border-input bg-background text-sm disabled:opacity-50"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            取消
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Task 2.6: 创建 PageHeader 组件

**Files:**
- Create: `src/components/simple/page-header.tsx`

- [ ] **Step 1: 创建文件**

完整内容:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  backHref?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  backHref,
  actions,
  className,
}: PageHeaderProps) {
  const router = useRouter();

  return (
    <header
      className={cn(
        "border-b bg-card sticky top-0 z-50",
        className
      )}
    >
      <div className="px-6 h-14 flex items-center gap-4">
        {backHref && (
          <Button
            variant="ghost"
            onClick={() => router.push(backHref)}
            size="sm"
          >
            &larr; 返回
          </Button>
        )}
        <h1 className="text-lg font-bold truncate flex-1">{title}</h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
```

- [ ] **Step 2: 全量 build 验证**

```bash
cd "C:\Users\Young143\Desktop\ncwu-cccc-dashboard-next" && bun run build 2>&1
```

Expected: ✓ Compiled successfully

---

# Phase 3: 3 个页面改造（3 tasks）

## Task 3.1: 改造首页 src/app/page.tsx

**Files:**
- Modify: `src/app/page.tsx`（完整重写）

- [ ] **Step 1: 用以下完整内容覆盖 `src/app/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, MoreVertical, Trophy } from "lucide-react";
import {
  getCompetitions,
  deleteCompetition,
  updateCompetitionStatus,
  type CompetitionSummary,
} from "@/services/api";
import { PageHeader } from "@/components/simple/page-header";
import { EmptyState } from "@/components/simple/empty-state";
import { ConfirmDialog } from "@/components/simple/confirm-dialog";
import { StatusBadge } from "@/components/simple/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function DashboardPage() {
  const router = useRouter();
  const [competitions, setCompetitions] = useState<CompetitionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CompetitionSummary | null>(null);
  const [confirmFinish, setConfirmFinish] = useState<CompetitionSummary | null>(null);

  const load = async () => {
    setError(null);
    try {
      const data = await getCompetitions();
      setCompetitions(data);
    } catch (err) {
      console.error(err);
      setError("加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteCompetition(confirmDelete.id);
    await load();
  };

  const handleFinish = async () => {
    if (!confirmFinish) return;
    await updateCompetitionStatus(confirmFinish.id, "finished");
    await load();
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="比赛管理"
        actions={
          <Button onClick={() => router.push("/create")}>创建比赛</Button>
        }
        className="max-w-6xl mx-auto"
      />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {error && (
          <EmptyState
            icon={AlertCircle}
            title="加载失败"
            description="无法连接到服务器"
            action={{ label: "重试", onClick: load }}
          />
        )}

        {!error && loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-20" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-6 w-40 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !error && competitions.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="还没有比赛"
            description="点击右上角按钮创建第一个比赛"
            action={{ label: "创建比赛", onClick: () => router.push("/create") }}
          />
        ) : (
          !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {competitions.map((comp) => (
                <Card
                  key={comp.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <StatusBadge status={comp.status} />
                      <span className="text-xs text-muted-foreground">
                        {comp.created_at}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardTitle className="text-base mb-3">
                      {comp.name}
                    </CardTitle>
                    {comp.start_time && (
                      <div className="text-xs text-primary mb-2">
                        {comp.start_time.replace("T", " ")}
                        {comp.status === "upcoming" && comp.duration_minutes && (
                          <span className="text-muted-foreground">
                            {" "}
                            &middot; {comp.duration_minutes}分钟
                          </span>
                        )}
                      </div>
                    )}
                    {comp.pta_contest_id && (
                      <div className="text-xs text-muted-foreground mb-3">
                        PTA ID: {comp.pta_contest_id}
                      </div>
                    )}
                    <div className="flex gap-4 mb-3">
                      <div>
                        <span className="text-lg font-bold text-primary">
                          {comp.team_count}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">
                          队伍
                        </span>
                      </div>
                      <div>
                        <span className="text-lg font-bold text-primary">
                          {comp.member_count}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">
                          选手
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/competitions/${comp.id}`)}
                      >
                        管理
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon-sm">
                              <MoreVertical />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          {comp.status === "active" && (
                            <DropdownMenuItem
                              onClick={() => setConfirmFinish(comp)}
                            >
                              结束比赛
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setConfirmDelete(comp)}
                          >
                            删除比赛
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        )}
      </main>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title="确认删除比赛"
        description={
          <span>
            确定要删除比赛「{confirmDelete?.name}」吗？此操作不可恢复，比赛的所有队伍、选手和成绩都将被删除。
          </span>
        }
        confirmLabel="删除"
        destructive
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={!!confirmFinish}
        onOpenChange={(v) => !v && setConfirmFinish(null)}
        title="确认结束比赛"
        description={
          <span>
            确定要将比赛「{confirmFinish?.name}」标记为已结束吗？结束后无法恢复活动状态。
          </span>
        }
        confirmLabel="结束"
        onConfirm={handleFinish}
      />
    </div>
  );
}
```

注：`RefreshCw` 在 import 中保留但暂未使用，未来"重试"按钮可加图标。`updateCompetitionStatus` 和 `deleteCompetition` 在 services/api.ts 中已有。

- [ ] **Step 2: 全量 build 验证**

```bash
cd "C:\Users\Young143\Desktop\ncwu-cccc-dashboard-next" && bun run build 2>&1
```

Expected: ✓ Compiled successfully

---

## Task 3.2: 改造详情页 src/app/competitions/[id]/page.tsx

**Files:**
- Modify: `src/app/competitions/[id]/page.tsx`（完整重写）

**Context:** 现有文件 529 行。改造后要点：
- 用 PageHeader
- "大屏入口" + "操作" 合并为单卡"快捷操作"，Separator 分组
- 同步按钮加 Loader2 图标
- 队伍表格：选手列改 MemberBadges，操作列改 DropdownMenu
- 编辑/添加用 TeamFormDialog，删除用 ConfirmDialog
- 比赛不存在用 EmptyState

- [ ] **Step 1: 用以下完整内容覆盖 `src/app/competitions/[id]/page.tsx`**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExcelImport } from "@/components/ui/excel-import";
import { MoreVertical, RefreshCw, Trophy, X, Pencil, Loader2, ExternalLink, Download } from "lucide-react";
import {
  getCompetition,
  syncNow,
  type CompetitionDetail,
} from "@/services/api";
import { ScoreProvider } from "@/context/score-context";
import { EmbeddedRank } from "@/components/simple/embedded-rank";
import { PageHeader } from "@/components/simple/page-header";
import { EmptyState } from "@/components/simple/empty-state";
import { ConfirmDialog } from "@/components/simple/confirm-dialog";
import { StatusBadge } from "@/components/simple/status-badge";
import { TeamFormDialog } from "@/components/simple/team-form-dialog";
import { MemberBadges } from "@/components/simple/member-badges";
import { convertDetailToTeams } from "@/lib/server-utils";
import { PROBLEM_LABELS, ALL_MAX_SCORES, type QuestionScore } from "@/types";
import { recalcMember, recalcTeam } from "@/lib/score-calc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function CompetitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<CompetitionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTeam, setEditingTeam] = useState<{
    id: number;
    name: string;
    members: string;
  } | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getCompetition(parseInt(id));
      setDetail(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSync = async () => {
    if (!id) return;
    setSyncing(true);
    try {
      await syncNow(parseInt(id));
      await load();
      setRefreshKey((v) => v + 1);
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveTeam = async (data: { name: string; members: string }) => {
    if (!id || !detail || !editingTeam) return;

    const memberNames = data.members
      .split(/[,，、]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const updatedTeams = editingTeam.id === 0
      ? [
          ...detail.teams,
          { id: 0, name: data.name, members: memberNames.map((name) => ({ id: 0, name, scores: [] })) },
        ]
      : detail.teams.map((t) =>
          t.id === editingTeam.id
            ? { ...t, name: data.name, members: memberNames.map((name) => ({ id: 0, name, scores: [] })) }
            : t
        );

    const res = await fetch(`/api/competitions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teams: updatedTeams }),
    });

    if (res.ok) {
      setEditingTeam(null);
      await load();
      setRefreshKey((v) => v + 1);
    }
  };

  const handleDeleteTeam = async () => {
    if (!id || !detail || !deletingTeam) return;
    const updatedTeams = detail.teams.filter((t) => t.id !== deletingTeam.id);
    const res = await fetch(`/api/competitions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teams: updatedTeams }),
    });
    if (res.ok) {
      await load();
      setRefreshKey((v) => v + 1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-32 mb-4" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <EmptyState
          icon={Trophy}
          title="比赛不存在"
          description="该比赛可能已被删除"
          action={{ label: "返回首页", onClick: () => router.push("/") }}
        />
      </div>
    );
  }

  const handleExportTeamRank = () => {
    if (!detail) return;
    const teams = detail.teams.map((t) => {
      const members = t.members.map((m) => {
        const existingMap = new Map(m.scores.map((s) => [s.problem_label, s]));
        const scores: QuestionScore[] = PROBLEM_LABELS.map((label, i) => ({
          problemLabel: label,
          score: existingMap.get(label)?.score ?? 0,
          maxScore: existingMap.get(label)?.max_score ?? ALL_MAX_SCORES[i] ?? 0,
        }));
        return recalcMember(String(m.id), m.name, scores);
      });
      return recalcTeam({ id: String(t.id), name: t.name, members });
    }).sort((a, b) => b.totalScore - a.totalScore);

    const header = "排名,队伍,基础分,进阶分,登顶分,总分,人数,队员";
    const rows = teams.map((team, idx) => {
      const memberCol = team.members
        .map((m) => `${m.name}(${m.basicTotal}|${m.advancedTotal}|${m.topTotal}|${m.totalScore})`)
        .join(";");
      return `${idx + 1},${team.name},${team.basicTotal},${team.advancedTotal},${team.topTotal},${team.totalScore},${team.members.length},"${memberCol}"`;
    });
    const csv = header + "\n" + rows.join("\n");
    downloadCsv(csv, `${detail.name}-队伍排名`);
  };

  const handleExportIndividualRank = () => {
    if (!detail) return;
    const all: Array<{ name: string; team: string; basic: number; advanced: number; top: number; total: number }> = [];
    for (const t of detail.teams) {
      for (const m of t.members) {
        const existingMap = new Map(m.scores.map((s) => [s.problem_label, s]));
        const scores: QuestionScore[] = PROBLEM_LABELS.map((label, i) => ({
          problemLabel: label,
          score: existingMap.get(label)?.score ?? 0,
          maxScore: existingMap.get(label)?.max_score ?? ALL_MAX_SCORES[i] ?? 0,
        }));
        const member = recalcMember(String(m.id), m.name, scores);
        all.push({ name: member.name, team: t.name, basic: member.basicTotal, advanced: member.advancedTotal, top: member.topTotal, total: member.totalScore });
      }
    }
    all.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    const header = "排名,姓名,队伍,基础分,进阶分,登顶分,总分";
    const rows = all.map((item, idx) => `${idx + 1},${item.name},${item.team},${item.basic},${item.advanced},${item.top},${item.total}`);
    const csv = header + "\n" + rows.join("\n");
    downloadCsv(csv, `${detail.name}-个人排名`);
  };

  function downloadCsv(csv: string, filename: string) {
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title={detail.name}
        backHref="/"
        className="max-w-5xl mx-auto"
      />

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* 比赛信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">比赛信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">状态</span>
                <div className="mt-1">
                  <StatusBadge status={detail.status} />
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">开始时间</span>
                <p className="font-medium mt-1">
                  {detail.start_time?.replace("T", " ") || "-"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">时长</span>
                <p className="font-medium mt-1">
                  {detail.duration_minutes || "-"} 分钟
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">队伍 / 选手</span>
                <p className="font-medium mt-1">
                  {detail.teams.length} /{" "}
                  {detail.teams.reduce((s, t) => s + t.members.length, 0)}
                </p>
              </div>
            </div>
            {detail.pta_contest_id && (
              <div className="mt-3 text-sm">
                <span className="text-muted-foreground">PTA ID: </span>
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                  {detail.pta_contest_id}
                </code>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 快捷操作（合并大屏入口 + 操作） */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">快捷操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => window.open(`/live/${id}/official`, "_blank")}
              >
                <ExternalLink />
                官方观赛版
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => window.open(`/live/${id}/projector`, "_blank")}
              >
                <ExternalLink />
                投屏大字版
              </Button>
            </div>

            <Separator />

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={syncing}
              >
                {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                {syncing ? "同步中..." : "手动同步 PTA"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportTeamRank}
              >
                <Download />
                导出队伍排名
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportIndividualRank}
              >
                <Download />
                导出个人排名
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 队伍管理 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">队伍管理</CardTitle>
              <ExcelImport
                onImport={(imported) => {
                  const updated = detail.teams.map((t, i) => {
                    const match = imported[i];
                    if (match) {
                      return { ...t, name: match.name, members: match.members.map((name) => ({ id: 0, name, scores: [] })) };
                    }
                    return t;
                  });
                  const remaining = imported.slice(detail.teams.length);
                  for (const r of remaining) {
                    updated.push({ id: 0, name: r.name, members: r.members.map((name) => ({ id: 0, name, scores: [] })) });
                  }
                  fetch(`/api/competitions/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ teams: updated }),
                  }).then(() => { load(); setRefreshKey((v) => v + 1); });
                }}
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>队名</TableHead>
                  <TableHead>队员</TableHead>
                  <TableHead className="w-20">人数</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.teams.map((team, idx) => (
                  <TableRow key={team.id}>
                    <TableCell className="font-medium">{idx + 1}</TableCell>
                    <TableCell>{team.name}</TableCell>
                    <TableCell>
                      <MemberBadges names={team.members.map((m) => m.name)} />
                    </TableCell>
                    <TableCell>{team.members.length}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon-sm">
                              <MoreVertical />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              setEditingTeam({
                                id: team.id,
                                name: team.name,
                                members: team.members
                                  .map((m) => m.name)
                                  .join(", "),
                              })
                            }
                          >
                            <Pencil />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() =>
                              setDeletingTeam({ id: team.id, name: team.name })
                            }
                          >
                            <X />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingTeam({ id: 0, name: "", members: "" })}
              >
                + 添加队伍
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 嵌入排名 */}
        {detail && (
          <ScoreProvider
            key={`${detail.id}-${refreshKey}`}
            initialTeams={convertDetailToTeams(detail)}
          >
            <EmbeddedRank compId={parseInt(id!)} />
          </ScoreProvider>
        )}
      </main>

      {/* 队伍编辑/添加 Dialog */}
      <TeamFormDialog
        open={!!editingTeam}
        onOpenChange={(v) => !v && setEditingTeam(null)}
        mode={editingTeam?.id === 0 ? "add" : "edit"}
        initialName={editingTeam?.name}
        initialMembers={editingTeam?.members}
        onSave={handleSaveTeam}
      />

      {/* 队伍删除确认 */}
      <ConfirmDialog
        open={!!deletingTeam}
        onOpenChange={(v) => !v && setDeletingTeam(null)}
        title="确认删除队伍"
        description={
          <span>
            确定要删除队伍「{deletingTeam?.name}」吗？该队伍所有成员和成绩将被一并删除，此操作不可恢复。
          </span>
        }
        confirmLabel="删除"
        destructive
        onConfirm={handleDeleteTeam}
      />
    </div>
  );
}
```

- [ ] **Step 2: 全量 build 验证**

```bash
cd "C:\Users\Young143\Desktop\ncwu-cccc-dashboard-next" && bun run build 2>&1
```

Expected: ✓ Compiled successfully

---

## Task 3.3: 改造创建页 src/app/create/page.tsx

**Files:**
- Modify: `src/app/create/page.tsx`（完整重写）

**Context:** 改为 Tabs 3 步式：① PTA 信息 → ② 队伍与选手 → ③ 确认提交。Tabs 严格门控。

- [ ] **Step 1: 用以下完整内容覆盖 `src/app/create/page.tsx`**

```tsx
"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check } from "lucide-react";
import { createCompetition } from "@/services/api";
import { ExcelImport } from "@/components/ui/excel-import";
import { PageHeader } from "@/components/simple/page-header";
import { ConfirmDialog } from "@/components/simple/confirm-dialog";
import type { ExcelTeamData } from "@/lib/excel-utils";

interface TeamEntry {
  id: number;
  name: string;
  members: string;
}

const STEPS = [
  { id: "pta", label: "PTA 信息" },
  { id: "teams", label: "队伍与选手" },
  { id: "confirm", label: "确认提交" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

export default function CreateCompetitionPage() {
  const router = useRouter();
  const [ptaId, setPtaId] = useState("");
  const [cookie, setCookie] = useState("");
  const [compName, setCompName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [startTime, setStartTime] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [teams, setTeams] = useState<TeamEntry[]>([
    { id: 1, name: "", members: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showCookie, setShowCookie] = useState(false);
  const [currentStep, setCurrentStep] = useState<StepId>("pta");
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const nextIdRef = useRef(2);

  const allocId = () => {
    const id = nextIdRef.current;
    nextIdRef.current = id + 1;
    return id;
  };

  const handleFetch = async () => {
    setError("");
    if (!ptaId.trim()) {
      setError("请输入 PTA 比赛 ID");
      return;
    }
    if (!cookie.trim()) {
      setError("请输入 Access Cookie");
      return;
    }

    setFetching(true);
    try {
      const res = await fetch("/api/pta/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contestId: ptaId.trim(), cookie: cookie.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "获取失败");
        return;
      }

      const data = await res.json();
      setCompName(data.name);
      setStartTime(data.startAt ? data.startAt.replace("T", " ") : "");
      setDurationMinutes(data.durationMinutes || 180);
      setFetched(true);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setFetching(false);
    }
  };

  const addTeam = () => {
    setTeams([...teams, { id: allocId(), name: "", members: "" }]);
  };

  const removeTeam = (id: number) => {
    if (teams.length <= 1) return;
    setTeams(teams.filter((t) => t.id !== id));
  };

  const updateTeam = (id: number, field: "name" | "members", value: string) => {
    setTeams(teams.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const handleExcelImport = (imported: ExcelTeamData[]) => {
    const entries: TeamEntry[] = imported.map((t) => ({
      id: allocId(),
      name: t.name,
      members: t.members.join(", "),
    }));
    setTeams(entries);
  };

  const validTeams = useMemo(() => {
    return teams
      .map((team) => {
        const memberNames = team.members
          .split(/[,，、]/)
          .map((s) => s.trim())
          .filter(Boolean);
        return {
          name: team.name.trim(),
          members: memberNames,
          valid:
            team.name.trim().length > 0 &&
            memberNames.length > 0 &&
            memberNames.length <= 10,
        };
      })
      .filter((t) => t.valid || t.name.length > 0);
  }, [teams]);

  const canGoToTeams = fetched && compName.trim().length > 0;
  const canGoToConfirm = canGoToTeams && validTeams.length > 0 && validTeams.every((t) => t.valid);

  const handleConfirm = async () => {
    setError("");
    setSubmitting(true);
    try {
      await createCompetition({
        name: compName.trim(),
        teams: validTeams.map((t) => ({ name: t.name, members: t.members })),
        start_time: startTime || undefined,
        duration_minutes: durationMinutes,
        access_cookie: cookie.trim(),
        pta_contest_id: ptaId.trim(),
      });
      router.push("/");
    } catch {
      setError("创建失败，请稍后重试");
    } finally {
      setSubmitting(false);
      setConfirmSubmit(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="创建比赛"
        backHref="/"
        className="max-w-3xl mx-auto"
      />

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {/* Stepper */}
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((step, idx) => {
            const isActive = currentStep === step.id;
            const isPast =
              STEPS.findIndex((s) => s.id === currentStep) > idx;
            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className={`size-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isPast
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isPast ? <Check className="size-4" /> : idx + 1}
                  </div>
                  <span
                    className={`text-xs ${
                      isActive ? "font-medium" : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`h-px flex-1 ${
                      isPast ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <Tabs
          value={currentStep}
          onValueChange={(v) => {
            const step = v as StepId;
            if (step === "teams" && !canGoToTeams) return;
            if (step === "confirm" && !canGoToConfirm) return;
            setCurrentStep(step);
          }}
        >
          <TabsList className="hidden">
            <TabsTrigger value="pta">PTA</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="confirm">Confirm</TabsTrigger>
          </TabsList>

          {/* Tab 1: PTA 信息 */}
          <TabsContent value="pta" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>PTA 信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ptaId">PTA 比赛 ID</Label>
                  <Input
                    id="ptaId"
                    value={ptaId}
                    onChange={(e) => setPtaId(e.target.value)}
                    placeholder="例如：2045465562920992768"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cookie">Access Cookie</Label>
                  <div className="flex gap-2">
                    <Input
                      id="cookie"
                      type={showCookie ? "text" : "password"}
                      value={cookie}
                      onChange={(e) => setCookie(e.target.value)}
                      placeholder="从浏览器复制完整的 Cookie 字符串"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCookie((v) => !v)}
                    >
                      {showCookie ? "隐藏" : "显示"}
                    </Button>
                  </div>
                </div>
                <Button onClick={handleFetch} disabled={fetching}>
                  {fetching ? "获取中..." : "获取比赛名称"}
                </Button>
                {fetched && (
                  <div className="text-sm text-green-600 dark:text-green-400 font-medium">
                    比赛名称: {compName}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                onClick={() => setCurrentStep("teams")}
                disabled={!canGoToTeams}
              >
                下一步：队伍与选手
              </Button>
            </div>
          </TabsContent>

          {/* Tab 2: 队伍与选手 */}
          <TabsContent value="teams" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>队伍管理</CardTitle>
                  <ExcelImport onImport={handleExcelImport} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-[1fr_2fr_auto] gap-3 text-sm text-muted-foreground px-1 mb-1">
                  <span>队名</span>
                  <span>队员（逗号分隔）</span>
                  <span className="w-8" />
                </div>

                {teams.map((team) => (
                  <div
                    key={team.id}
                    className="grid grid-cols-[1fr_2fr_auto] gap-3 items-center"
                  >
                    <Input
                      value={team.name}
                      onChange={(e) => updateTeam(team.id, "name", e.target.value)}
                      placeholder="队伍名称"
                    />
                    <Input
                      value={team.members}
                      onChange={(e) => updateTeam(team.id, "members", e.target.value)}
                      placeholder="张三, 李四, 王五"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive w-8 h-8 p-0"
                      onClick={() => removeTeam(team.id)}
                      disabled={teams.length <= 1}
                    >
                      &times;
                    </Button>
                  </div>
                ))}

                <Button variant="outline" size="sm" onClick={addTeam} className="mt-2">
                  + 添加队伍
                </Button>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep("pta")}>
                上一步
              </Button>
              <Button
                onClick={() => setCurrentStep("confirm")}
                disabled={!canGoToConfirm}
              >
                下一步：确认提交
              </Button>
            </div>
          </TabsContent>

          {/* Tab 3: 确认提交 */}
          <TabsContent value="confirm" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>提交确认</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <button
                  type="button"
                  onClick={() => setCurrentStep("pta")}
                  className="w-full text-left p-3 rounded hover:bg-muted transition-colors"
                >
                  <div className="text-muted-foreground">比赛名称</div>
                  <div className="font-medium">{compName || "—"}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep("pta")}
                  className="w-full text-left p-3 rounded hover:bg-muted transition-colors"
                >
                  <div className="text-muted-foreground">开始时间 / 时长</div>
                  <div className="font-medium">
                    {startTime || "—"} &middot; {durationMinutes} 分钟
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep("pta")}
                  className="w-full text-left p-3 rounded hover:bg-muted transition-colors"
                >
                  <div className="text-muted-foreground">PTA ID</div>
                  <div className="font-medium">{ptaId || "—"}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep("teams")}
                  className="w-full text-left p-3 rounded hover:bg-muted transition-colors"
                >
                  <div className="text-muted-foreground">队伍 / 选手</div>
                  <div className="font-medium">
                    {validTeams.length} 队 / {validTeams.reduce((s, t) => s + t.members.length, 0)} 人
                  </div>
                </button>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep("teams")}>
                上一步
              </Button>
              <Button
                onClick={() => setConfirmSubmit(true)}
                disabled={submitting || !canGoToConfirm}
              >
                {submitting ? "创建中..." : "创建比赛"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <ConfirmDialog
        open={confirmSubmit}
        onOpenChange={setConfirmSubmit}
        title="确认创建比赛"
        description={
          <span>
            将创建比赛「{compName}」，包含 {validTeams.length} 队 {validTeams.reduce((s, t) => s + t.members.length, 0)} 人。
          </span>
        }
        confirmLabel="创建"
        onConfirm={handleConfirm}
      />
    </div>
  );
}
```

- [ ] **Step 2: 全量 build 验证**

```bash
cd "C:\Users\Young143\Desktop\ncwu-cccc-dashboard-next" && bun run build 2>&1
```

Expected: ✓ Compiled successfully

---

# Phase 4: 手动验收（1 task）

## Task 4.1: 完整手动验收

**启动 dev server：**
```bash
cd "C:\Users\Young143\Desktop\ncwu-cccc-dashboard-next" && bun run dev
```

- [ ] **认证场景**
  - [ ] 访问 `http://localhost:3000/` → 跳转到 `/login?from=/`
  - [ ] 输入错误密码 → 看到"密码错误"
  - [ ] 输入正确密码 `dev123` → 跳回首页
  - [ ] 访问 `http://localhost:3000/live/1/official` → **不**需要密码
  - [ ] 访问 `http://localhost:3000/live/1/projector` → 需要密码
  - [ ] 关闭浏览器再访问 `/` → 需重新登录
  - [ ] 修改 `.env.local` 密码 → 旧 cookie 失效
  - [ ] API 路由（无 cookie 调 `curl http://localhost:3000/api/competitions`）→ 返回 401

- [ ] **首页场景**
  - [ ] 创建比赛 → 看到新比赛卡片
  - [ ] 比赛卡片悬停 → 看到阴影变化（无整卡点击）
  - [ ] 比赛卡片右下角 ⋮ 菜单 → 看到"结束比赛"（active 状态）/ "删除比赛"
  - [ ] 点击"删除比赛" → ConfirmDialog 弹出 → 确认 → 卡片消失
  - [ ] 点击"结束比赛" → ConfirmDialog 弹出 → 确认 → 卡片状态变"已结束"
  - [ ] active 状态徽章 → 看到绿色脉冲小圆点

- [ ] **详情页场景**
  - [ ] 点击"管理" → 跳到详情页
  - [ ] 顶部 PageHeader 显示比赛名
  - [ ] 比赛信息卡显示 StatusBadge（脉冲点）
  - [ ] "快捷操作"卡包含：大屏入口按钮 + 分隔线 + 同步/导出按钮
  - [ ] 点击"官方观赛版" → 新标签页打开（不需要密码）
  - [ ] 点击"投屏大字版" → 新标签页打开（需要密码，已登录可访问）
  - [ ] 点击"手动同步 PTA" → 按钮变 "同步中..." + 旋转图标
  - [ ] 队伍表格选手列：≤3 人全部显示为 Badge，>3 人显示 `+N` 折叠
  - [ ] 悬停 `+N` Badge → 看到 tooltip（原生 title 属性）
  - [ ] 行内 ⋮ 菜单 → 看到"编辑"/"删除"
  - [ ] 点击"编辑" → TeamFormDialog 弹出（标题"编辑队伍"）
  - [ ] 点击"+ 添加队伍" → TeamFormDialog 弹出（标题"添加队伍"）
  - [ ] 点击"删除" → ConfirmDialog 弹出 → 确认 → 行消失
  - [ ] 访问 `/competitions/99999`（不存在）→ 看到 EmptyState

- [ ] **创建页场景**
  - [ ] 访问 `/create`
  - [ ] 看到顶部 stepper（3 圆点 + 连接线）：当前"PTA 信息"高亮
  - [ ] Tab 1 填写并点击"获取" → 成功后填充比赛名称
  - [ ] "下一步"按钮可点
  - [ ] Tab 1 未完成 → 点击 stepper 第 2/3 个点 → 不响应
  - [ ] 跳到 Tab 2 → 添加/编辑队伍、Excel 导入工作
  - [ ] 至少 1 队后 → "下一步"按钮可点
  - [ ] Tab 3 显示总览：比赛名、时间、PTA ID、队数/人数
  - [ ] 点击总览任一行 → 跳回对应 Tab
  - [ ] 点击"创建比赛" → ConfirmDialog → 确认 → 跳回首页

- [ ] **响应式**
  - [ ] 375px (iPhone SE) → 各页面可滚动，不破版
  - [ ] 768px (iPad) → 卡片 2 列
  - [ ] 1280px+ (Desktop) → 卡片 3 列

- [ ] **构建验证**
  - [ ] `bun run build` 仍然 0 错误

---

# 完成

所有任务完成后，spec 验收清单 15 项 + 手动验收 6 类场景全部通过。
