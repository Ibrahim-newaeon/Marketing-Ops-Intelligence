export function LoadingState({ label = "Loading…" }: { label?: string }): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="loading-state"
      className="flex items-center gap-2 p-6 text-sm text-muted-foreground"
    >
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
      {label}
    </div>
  );
}
