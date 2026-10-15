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
    return <span className="text-muted-foreground text-sm">—</span>;
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
