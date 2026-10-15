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
        "sticky top-0 z-50 border-b bg-card shadow-sm supports-[backdrop-filter]:bg-card/80 supports-[backdrop-filter]:backdrop-blur",
        className
      )}
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-4">
        {backHref && (
          <Button
            variant="ghost"
            onClick={() => router.push(backHref)}
            size="sm"
          >
            &larr; 返回
          </Button>
        )}
        <h1 className="text-lg font-bold truncate flex-1 min-w-0">{title}</h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
