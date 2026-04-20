import { cn } from "@/lib/utils";

export interface KpiCardProps {
  label: string;
  value: string;
  delta?: string;
  tone?: "neutral" | "positive" | "negative";
  testId?: string;
  ariaLabel?: string;
}

export function KpiCard({
  label,
  value,
  delta,
  tone = "neutral",
  testId,
  ariaLabel,
}: KpiCardProps): JSX.Element {
  return (
    <div
      role="group"
      data-testid={testId}
      aria-label={ariaLabel ?? label}
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums" data-testid={`${testId}-value`}>
        {value}
      </div>
      {delta && (
        <div
          className={cn(
            "mt-1 text-xs tabular-nums",
            tone === "positive" && "text-emerald-600",
            tone === "negative" && "text-destructive",
            tone === "neutral" && "text-muted-foreground"
          )}
          data-testid={`${testId}-delta`}
        >
          {delta}
        </div>
      )}
    </div>
  );
}
