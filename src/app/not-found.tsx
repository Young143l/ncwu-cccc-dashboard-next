import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <p className="text-6xl font-semibold tracking-tight text-muted-foreground/40">
        404
      </p>
      <h1 className="text-xl font-semibold">页面不存在</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        链接可能已经失效，或比赛已被删除。请返回首页重新选择比赛。
      </p>
      <Link href="/" className={`${buttonVariants()} mt-2`}>
        返回首页
      </Link>
    </div>
  );
}
