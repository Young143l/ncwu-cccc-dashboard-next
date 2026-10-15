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
